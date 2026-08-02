export function executePrint(intentUrl: string) {
    // Check if the current platform is Android
    const isAndroid = /android/i.test(navigator.userAgent);
    
    if (isAndroid) {
        // Fallback to standard intent link for Android devices
        window.location.href = intentUrl;
    } else {
        // Native Windows Protocol Handler trigger (zatiaraprint://)
        const windowsProtocolUrl = intentUrl.replace(/^intent:\/\//i, "zatiaraprint://");
        
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
