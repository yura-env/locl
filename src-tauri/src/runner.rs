use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::process::{Command, Stdio};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// id -> OS process id of the shell we spawned.
#[derive(Default)]
pub struct Procs(pub Mutex<HashMap<String, u32>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogEvent {
    id: String,
    stream: &'static str,
    line: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExitEvent {
    id: String,
    code: Option<i32>,
}

fn shell(command: &str) -> Command {
    #[cfg(windows)]
    {
        let mut c = Command::new("cmd");
        c.args(["/C", command]);
        c.creation_flags(CREATE_NO_WINDOW);
        c
    }
    #[cfg(not(windows))]
    {
        let mut c = Command::new("sh");
        c.args(["-c", command]);
        c
    }
}

/// Pumps a stream line-by-line into `proc-log` events.
/// Reads bytes rather than `lines()` so a dev server that prints a prompt
/// without a trailing newline still shows up.
fn pump<R: Read + Send + 'static>(
    app: AppHandle,
    id: String,
    stream: &'static str,
    reader: R,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut buf = Vec::new();
        loop {
            buf.clear();
            match reader.read_until(b'\n', &mut buf) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let line = String::from_utf8_lossy(&buf)
                        .trim_end_matches(['\n', '\r'])
                        .to_string();
                    let _ = app.emit(
                        "proc-log",
                        LogEvent {
                            id: id.clone(),
                            stream,
                            line,
                        },
                    );
                }
            }
        }
    })
}

#[tauri::command]
pub fn start_project(
    app: AppHandle,
    procs: State<Procs>,
    id: String,
    path: String,
    command: String,
) -> Result<u32, String> {
    if procs.0.lock().unwrap().contains_key(&id) {
        return Err("Already running.".into());
    }
    if !std::path::Path::new(&path).is_dir() {
        return Err(format!("Folder not found: {path}"));
    }

    let mut child = shell(&command)
        .current_dir(&path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not start: {e}"))?;

    let pid = child.id();
    procs.0.lock().unwrap().insert(id.clone(), pid);

    let out = pump(
        app.clone(),
        id.clone(),
        "stdout",
        child.stdout.take().expect("piped"),
    );
    let err = pump(
        app.clone(),
        id.clone(),
        "stderr",
        child.stderr.take().expect("piped"),
    );

    // One waiter thread owns the Child so nothing is left zombied.
    std::thread::spawn(move || {
        let status = child.wait();
        let _ = out.join();
        let _ = err.join();

        let state: State<Procs> = app.state();
        // Only clear the slot if it still points at *this* run.
        let mut map = state.0.lock().unwrap();
        if map.get(&id) == Some(&pid) {
            map.remove(&id);
        }
        drop(map);

        let _ = app.emit(
            "proc-exit",
            ExitEvent {
                id,
                code: status.ok().and_then(|s| s.code()),
            },
        );
    });

    Ok(pid)
}

/// `npm run dev` spawns node as a grandchild, so killing the shell alone
/// leaves the server holding the port. `/T` takes the whole tree.
fn kill_tree(pid: u32) {
    #[cfg(windows)]
    {
        let mut c = Command::new("taskkill");
        c.args(["/PID", &pid.to_string(), "/T", "/F"]);
        c.creation_flags(CREATE_NO_WINDOW);
        let _ = c.stdout(Stdio::null()).stderr(Stdio::null()).status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("pkill")
            .args(["-TERM", "-P", &pid.to_string()])
            .status();
        let _ = Command::new("kill").arg(pid.to_string()).status();
    }
}

#[tauri::command]
pub fn stop_project(procs: State<Procs>, id: String) -> Result<(), String> {
    let pid = procs.0.lock().unwrap().get(&id).copied();
    match pid {
        Some(pid) => {
            kill_tree(pid);
            Ok(())
        }
        None => Err("Not running.".into()),
    }
}

#[tauri::command]
pub fn stop_all(procs: State<Procs>) {
    let pids: Vec<u32> = procs.0.lock().unwrap().values().copied().collect();
    for pid in pids {
        kill_tree(pid);
    }
}

#[tauri::command]
pub fn running_ids(procs: State<Procs>) -> Vec<String> {
    procs.0.lock().unwrap().keys().cloned().collect()
}

/// Called on app exit. The waiter threads die with the process, so this is
/// the last chance to reap the dev servers.
pub fn kill_everything(procs: &Procs) {
    let pids: Vec<u32> = procs.0.lock().unwrap().values().copied().collect();
    for pid in pids {
        kill_tree(pid);
    }
}
