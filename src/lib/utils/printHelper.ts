export function executePrint(intentUrl: string) {
    const isAndroid = /android/i.test(navigator.userAgent);

    // Extract base64 payload from intent string
    let base64 = intentUrl;
    const match = intentUrl.match(/S\.content=([^;]+)/);
    if (match) {
        base64 = match[1];
    }
    
    if (isAndroid) {
        // Direct RawBT protocol link for Android (bypasses Chrome async intent blocking)
        const rawbtUrl = `rawbt:base64,${base64}`;
        
        // Attempt rawbt: protocol first, fallback to standard intent
        try {
            window.location.href = rawbtUrl;
        } catch {
            window.location.href = intentUrl;
        }
    } else {
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
