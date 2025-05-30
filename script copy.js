// --- Pulsechain Parent Token Lookup Only ---

document.addEventListener('DOMContentLoaded', function() {
    const parentSearchButton = document.getElementById('parent-search-button');
    if (parentSearchButton) {
        parentSearchButton.addEventListener('click', handleParentSearch);
    }

    const darkModeToggle = document.getElementById('toggle-theme');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            if (document.body.classList.contains('dark-mode')) {
                document.body.classList.remove('dark-mode');
                document.body.classList.add('light-mode');
            } else {
                document.body.classList.remove('light-mode');
                document.body.classList.add('dark-mode');
            }
        });
    }

    // Set dark mode as default
    document.body.classList.add('dark-mode');
});

// Constants for parent lookup
const pulsechainParentABI = [
    "function GetStandardTokenParent(address token) view returns (address)"
];
const pulsechainParentAddress = "0x394c3D5990cEfC7Be36B82FDB07a7251ACe61cc7";
const PULSECHAIN_RPC = "https://rpc.pulsechain.com"; // Replace with actual endpoint if needed

// Handle the parent token search
async function handleParentSearch() {
    const input = document.getElementById('parent-search-input');
    const outputDiv = document.getElementById('queried-parent-info');
    const outputAddress = document.getElementById('queried-parent-address');
    const outputName = document.getElementById('queried-parent-name');
    const outputSymbol = document.getElementById('queried-parent-symbol');
    const explorerLink = document.getElementById('midgard-explorer-link');

    if (!input || !outputDiv || !outputAddress || !outputName || !outputSymbol || !explorerLink) {
        alert("Required UI elements for parent search not found.");
        return;
    }

    let tokenAddress = input.value.trim();
    outputDiv.style.display = "none";
    outputAddress.textContent = "";
    outputName.textContent = "";
    outputSymbol.textContent = "";
    explorerLink.style.display = "none";
    explorerLink.href = "#";

    tokenAddress = tokenAddress.replace(/[\s\u200B-\u200D\uFEFF]/g, '');

    if (!tokenAddress) {
        alert("Please enter a token address.");
        return;
    }
    if (typeof ethers === "undefined") {
        alert("ethers.js not loaded.");
        return;
    }
    if (!ethers.utils.isAddress(tokenAddress)) {
        try {
            tokenAddress = ethers.utils.getAddress(tokenAddress);
            console.log("Checksummed address:", tokenAddress);
        } catch {
            alert("Invalid address format. Please check for typos or extra spaces.");
            return;
        }
    }

    try {
        const provider = new ethers.providers.JsonRpcProvider(PULSECHAIN_RPC);
        const contract = new ethers.Contract(pulsechainParentAddress, pulsechainParentABI, provider);
        const parent = await contract.GetStandardTokenParent(tokenAddress);

        outputDiv.style.display = "block";
        if (parent && parent !== ethers.constants.AddressZero) {
            // Fetch parent token name and symbol
            let parentName = "";
            let parentSymbol = "";
            try {
                const parentContract = new ethers.Contract(parent, [
                    "function name() view returns (string)",
                    "function symbol() view returns (string)"
                ], contract.provider);
                parentName = await parentContract.name();
                parentSymbol = await parentContract.symbol();
            } catch (e) {
                console.warn("Could not fetch parent token name or symbol:", e);
            }
            outputAddress.textContent = parent;
            outputName.textContent = parentName;
            outputSymbol.textContent = parentSymbol;
            explorerLink.style.display = "inline";
            explorerLink.href = `https://midgard.wtf/token/${parent}`;
        } else {
            outputAddress.textContent = "No parent found";
        }
    } catch (err) {
        outputDiv.style.display = "block";
        if (err.code === 'CALL_EXCEPTION' && err.message.includes('missing revert data')) {
            outputAddress.textContent = "No parent found or token not recognized by contract.";
        } else {
            outputAddress.textContent = "Error: " + (err.message || "Could not query parent token.");
        }
        console.error("Error querying parent token:", err);
    }
}