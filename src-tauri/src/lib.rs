mod runner;

use runner::Procs;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

use std::sync::atomic::{AtomicBool, Ordering};

const MAIN: &str = "main";

/// Whether the panel has actually held focus since it was last shown.
///
/// Click-away dismiss must not fire on a window that never got focus in the
/// first place. On a fresh install the panel opens and the installer's finish
/// page immediately takes focus back, which used to hide the panel instantly:
/// the app looked like it had failed to start.
static HAD_FOCUS: AtomicBool = AtomicBool::new(false);

fn toggle_panel(app: &tauri::AppHandle) {
    let Some(win) = app.get_webview_window(MAIN) else {
        return;
    };
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
    } else {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// Park the panel near the tray: bottom-right of the work area, inset a little.
/// Exposed as a command because the panel resizes itself to fit its contents,
/// and a resize keeps the top-left fixed, which makes it walk up the screen.
#[tauri::command]
fn park(window: tauri::WebviewWindow) {
    park_near_tray(&window);
}

fn park_near_tray(win: &tauri::WebviewWindow) {
    let (Ok(Some(monitor)), Ok(size)) = (win.current_monitor(), win.outer_size()) else {
        return;
    };
    let area = monitor.size();
    let pos = monitor.position();
    let margin = 12i32;
    let x = pos.x + area.width as i32 - size.width as i32 - margin;
    // Sit above the taskbar rather than guessing its height.
    let y = pos.y + area.height as i32 - size.height as i32 - 56 - margin;
    let _ = win.set_position(tauri::PhysicalPosition::new(x.max(pos.x), y.max(pos.y)));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
        // A second launch just re-opens the panel already running.
        if let Some(win) = app.get_webview_window(MAIN) {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }));

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(Procs::default())
        .invoke_handler(tauri::generate_handler![
            runner::start_project,
            runner::stop_project,
            runner::stop_all,
            runner::running_ids,
            park,
        ])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Open Locl", true, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop_all", "Stop all servers", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &stop, &sep, &quit])?;

            TrayIconBuilder::with_id("locl-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Locl: your projects, one click away")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window(MAIN) {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "stop_all" => {
                        runner::kill_everything(&app.state::<Procs>());
                        let _ = app.emit("stopped-all", ());
                    }
                    "quit" => {
                        runner::kill_everything(&app.state::<Procs>());
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_panel(tray.app_handle());
                    }
                })
                .build(app)?;

            if let Some(win) = app.get_webview_window(MAIN) {
                park_near_tray(&win);
                let _ = win.show();
                let _ = win.set_focus();
            }
            Ok(())
        })
        .on_window_event(|win, event| match event {
            // Closing the panel parks it in the tray; servers keep running.
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = win.hide();
            }
            WindowEvent::Focused(true) => {
                HAD_FOCUS.store(true, Ordering::Relaxed);
            }
            // Click-away dismiss, but only in a real build, since it fights DevTools.
            #[cfg(not(debug_assertions))]
            WindowEvent::Focused(false) => {
                // Only dismiss a panel the user actually had in front of them.
                if HAD_FOCUS.swap(false, Ordering::Relaxed) {
                    let _ = win.hide();
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building Locl")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
                runner::kill_everything(&app.state::<Procs>());
            }
        });
}
