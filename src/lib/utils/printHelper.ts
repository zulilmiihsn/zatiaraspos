export function executePrint(intentUrl: string) {
    // Check if the current platform is Android
    const isAndroid = /android/i.test(navigator.userAgent);
    
    if (isAndroid) {
        // Fallback to standard intent link for Android devices
        window.location.href = intentUrl;
    } else {
        // High-compatibility multi-protocol print handler for PCs
        const httpEndpoints = [
            "http://127.0.0.1:40213/print",
            "http://localhost:40213/print"
        ];
        const wsEndpoints = [
            "ws://localhost:40213/",
            "ws://127.0.0.1:40213/"
        ];

        let attempts = 0;

        async function tryHttpPrint() {
            for (const url of httpEndpoints) {
                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        body: intentUrl,
                        headers: { 'Content-Type': 'text/plain' }
                    });
                    if (res.ok) {
                        return true;
                    }
                } catch (e) {
                    console.warn(`HTTP print attempt failed for ${url}:`, e);
                }
            }
            return false;
        }

        function tryWsPrint(index = 0) {
            if (index >= wsEndpoints.length) {
                alert("Printer tidak dapat diakses!\nPastikan 'RawBT Print Server' sudah dijalankan di komputer ini.");
                return;
            }

            const url = wsEndpoints[index];
            try {
                const socket = new WebSocket(url);
                let sent = false;

                socket.onopen = () => {
                    sent = true;
                    socket.send(intentUrl);
                    socket.close(1000, "Print request sent");
                };

                socket.onerror = () => {
                    if (!sent) tryWsPrint(index + 1);
                };
            } catch (e) {
                tryWsPrint(index + 1);
            }
        }

        // Try HTTP POST first (bypasses browser WebSocket HTTPS restrictions via CORS/PNA), fallback to WebSocket
        tryHttpPrint().then((success) => {
            if (!success) {
                tryWsPrint(0);
            }
        });
    }
}
