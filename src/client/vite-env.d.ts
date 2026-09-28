interface ImportMetaEnv {
    readonly VITE_GREEN_API_ID_INSTANCE?: string;
    readonly VITE_GREEN_API_TOKEN_INSTANCE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
