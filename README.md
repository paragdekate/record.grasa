# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Database & Synchronization

This project is integrated with **Supabase** for user authentication and bidirectional data synchronization.

- **Authentication**: Users sign in using Google Auth.
- **Sync Logic**: Offline-first design. Readings and alerts are stored in `localStorage` and automatically synchronized bidirectionally with Supabase when online.
- **Supabase Configuration**: For the SQL table schemas (including RLS policies) and Edge Function setups, please refer to [supabase_setup_instructions.md](file:///Users/Parag/record.grasa/supabase_setup_instructions.md).
- **iOS/Android Push Notifications**: See [notification_fix.md](file:///Users/Parag/record.grasa/notification_fix.md) for details on push notification setup and troubleshooting.
