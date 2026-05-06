#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

pub mod commands;
pub mod db;

use commands::*;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_members,
            search_members,
            add_member,
            update_member,
            delete_member,
            batch_import_members,
            get_services,
            add_service,
            update_service,
            delete_service,
            get_levels,
            update_level,
            get_records,
            delete_record,
            checkout,
            recharge,
            get_recharges,
            export_all_data,
            clear_all_data,
            daily_backup,
            manual_backup,
            get_backup_config,
            save_backup_config,
        ])
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create data dir");
            let db_path = data_dir.join("xiaofeng.db");
            db::init_db(&db_path).expect("failed to init database");
            app.manage(db_path);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
