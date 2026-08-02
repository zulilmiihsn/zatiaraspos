export function executePrint(intentUrl: string) {
    const isAndroid = /android/i.test(navigator.userAgent);

    if (isAndroid) {
        // Standard original RawBT intent link for Android (100% original working method)
        window.location.href = intentUrl;
    } else {
        // Extract base64 payload from intent string for Windows
        let base64 = intentUrl;
        const match = intentUrl.match(/S\.content=([^;]+)/);
        if (match) {
            base64 = match[1];
        }

        // Native Windows Protocol Handler trigger (zatiarasprint://)
        const windowsProtocolUrl = `zatiarasprint://${base64}`;
        
        try {
            // Trigger native Windows handler
            window.location.href = windowsProtocolUrl;
        } catch (e) {
            console.warn("Failed to trigger Windows native print protocol:", e);
        }

        // Fallback attempt via HTTP POST & WebSocket for older setups
        const httpEndpoints = ["http://127.0.0.1:40213/print", "http://localhost:40213/print"];
        fetch(httpEndpoints[0], { method: 'POST', mode: 'no-cors', body: intentUrl }).catch(() => {});
    }
}
