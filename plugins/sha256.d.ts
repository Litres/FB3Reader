interface Isha256 {
    (message: string | ArrayLike<number> | Uint8Array | ArrayBuffer): string;
}

declare var sha256: Isha256;

declare module 'sha256' {
    export = sha256;
}