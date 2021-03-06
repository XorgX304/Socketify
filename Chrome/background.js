var messengerPorts = {};

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status !== "complete" || !tab.url.startsWith("file:///")) {
        return;
    }

    chrome.tabs.executeScript(tabId, { file: "content.js" });
});

function disconnectTabPorts(tabPorts) {
    for (var id in tabPorts) {
        var port = tabPorts[id];
        if (!port) {
            continue;
        }

        port.disconnect();
        delete tabPorts[id];
    }
}

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    var tabPorts = messengerPorts[tabId];
    if (!tabPorts) {
        return;
    }

    disconnectTabPorts(tabPorts);
    delete messengerPorts[tabId];
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!sender.tab) {
        return;
    }

    var tabId = sender.tab.id;

    var tabPorts = messengerPorts[tabId];
    if (!tabPorts) {
        tabPorts = {};
        messengerPorts[tabId] = tabPorts;
    } else if (message.init) {
        disconnectTabPorts(tabPorts);
    }

    var id = message.id;
    if (!id) {
        return;
    }

    var port = tabPorts[id];
    if (!port) {
        if (message._msg.event === "open-udpPeer" ||
            message._msg.event === "open-tcpServer" ||
            message._msg.event === "open-tcpClient") {
            tabPorts[id] = port = chrome.runtime.connectNative("net.socketify.messenger");
            port.onDisconnect.addListener(function () {
                delete tabPorts[id];
            });
            port.onMessage.addListener(function (message) {
                if (message.payload) {
                    message.payload = JSON.parse(message.payload)
                }

                chrome.tabs.sendMessage(tabId, {
                    id: id,
                    _msg: message
                });
            });

            port.postMessage({
                event: message._msg.event,
                address: message._msg.address
            });
        }
        return;
    }

    port.postMessage({
        event: message._msg.event,
        address: message._msg.address,
        payload: JSON.stringify(message._msg.payload)
    });
});
