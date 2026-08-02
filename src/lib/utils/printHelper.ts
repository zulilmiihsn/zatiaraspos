export function executePrint(intentUrl: string) {
    // Check if the current platform is Android
    const isAndroid = /android/i.test(navigator.userAgent);
    
    if (isAndroid) {
        // Fallback to standard intent link for Android devices
        window.location.href = intentUrl;
    } else {
        // Extract base64 payload from intent string
        let base64 = intentUrl;
        const match = intentUrl.match(/S\.content=([^;]+)/);
        if (match) {
            base64 = match[1];
        }

        // Clean protocol URL without # fragment truncation
        const windowsProtocolUrl = `zatiarasprint://${base64}`;
        
        try {
            // Trigger native Windows handler
            window.location.href = windowsProtocolUrl;
        } catch (e) {
            console.warn("Failed to trigger Windows native print protocol:", e);
        }

        // Fallback attempt via HTTP POST & WebSocket
        const httpEndpoints = ["http://127.0.0.1:40213/print", "http://localhost:40213/print"];
        fetch(httpEndpoints[0], { method: 'POST', mode: 'no-cors', body: intentUrl }).catch(() => {});
    }
}
