import os from "node:os";

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  isVirtual: boolean;
  priority: number;
}

export function getSortedNetworkInterfaces(): NetworkInterfaceInfo[] {
  const interfaces = os.networkInterfaces();
  const results: NetworkInterfaceInfo[] = [];

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();

    // Check for common virtual / container / host-only adapter identifiers
    const isVirtualName =
      lowerName.includes("virtual") ||
      lowerName.includes("vbox") ||
      lowerName.includes("vmware") ||
      lowerName.includes("wsl") ||
      lowerName.includes("docker") ||
      lowerName.includes("hyper-v") ||
      lowerName.includes("vethernet") ||
      lowerName.includes("pseudo") ||
      lowerName.includes("teredo") ||
      lowerName.includes("tap") ||
      lowerName.includes("tun");

    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        // Known host-only subnets (e.g., VirtualBox default 192.168.56.x)
        const isVirtualSubnet =
          iface.address.startsWith("192.168.56.") ||
          iface.address.startsWith("169.254."); // APIPA link-local

        const isVirtual = isVirtualName || isVirtualSubnet;

        // Priority weighting:
        // Wi-Fi / WLAN physical adapter: highest (30)
        // Ethernet physical adapter: medium (20)
        // Virtual adapters: lowest (0)
        let priority = 10;
        if (isVirtual) {
          priority = 0;
        } else if (
          lowerName.includes("wi-fi") ||
          lowerName.includes("wireless") ||
          lowerName.includes("wlan")
        ) {
          priority = 30;
        } else if (lowerName.includes("ethernet") || lowerName.includes("eth")) {
          priority = 20;
        }

        results.push({
          name,
          address: iface.address,
          isVirtual,
          priority,
        });
      }
    }
  }

  // Sort descending by priority, then ascending by address
  return results.sort((a, b) => b.priority - a.priority);
}

export function getPrimaryIpAddress(): string {
  const interfaces = getSortedNetworkInterfaces();
  return interfaces[0]?.address || "127.0.0.1";
}
