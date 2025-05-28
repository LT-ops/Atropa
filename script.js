// Initialize Supabase client
// You must include the Supabase JS client in your HTML: 
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>
const SUPABASE_URL = 'https://uevfxvbgaeesomexyogf.supabase.co';
const SUPABASE_KEY = '..eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmZ4dmJnYWVlc29tZXh5b2dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0NDUyMTksImV4cCI6MjA2NDAyMTIxOX0.iRzDpthPKvmWUNdwSMAZD5R6Xt3eeDUxiAGnBYviom4..';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); // <--- use window.supabase

// Fetch token data from Supabase by address
async function fetchTokenFromSupabase(tokenAddress) {
    const { data, error } = await sb
        .from('tokens')
        .select('address, name, symbol, parent_address')
        .eq('address', tokenAddress.toLowerCase())
        .single();
    if (error) {
        console.warn('Supabase error:', error);
        return null;
    }
    return data;
}
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

// Add a loading indicator element to the DOM if not present
function ensureLoadingIndicator() {
    let loading = document.getElementById('loading-indicator');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading-indicator';
        loading.style.display = 'none';
        loading.style.position = 'fixed';
        loading.style.top = '10px';
        loading.style.right = '10px';
        loading.style.background = '#222';
        loading.style.color = '#fff';
        loading.style.padding = '8px 16px';
        loading.style.borderRadius = '6px';
        loading.style.zIndex = 1000;
        loading.textContent = 'Loading...';
        document.body.appendChild(loading);
    }
    return loading;
}

async function handleParentSearch() {
    const input = document.getElementById('parent-search-input');
    const outputDiv = document.getElementById('queried-parent-info');
    const outputAddress = document.getElementById('queried-parent-address');
    const outputName = document.getElementById('queried-parent-name');
    const outputSymbol = document.getElementById('queried-parent-symbol');
    const explorerLink = document.getElementById('midgard-explorer-link');
    const loading = ensureLoadingIndicator();
    const subtitle = document.querySelector('.subtitle');

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
    if (subtitle) subtitle.textContent = "Enter a Pulsechain token address below to find its parent token using the official contract.";

    if (!tokenAddress) {
        alert("Please enter a token address.");
        return;
    }

    loading.style.display = 'block';
    loading.textContent = 'Searching...';

    // Try to fetch token data from Supabase first
    let supabaseToken = null;
    let supabaseError = null;
    try {
        supabaseToken = await fetchTokenFromSupabase(tokenAddress);
    } catch (e) {
        supabaseError = e;
    }

    if (supabaseToken) {
        outputDiv.style.display = "block";
        outputAddress.textContent = supabaseToken.parent_address || "No parent found";
        outputName.textContent = supabaseToken.name || "";
        outputSymbol.textContent = supabaseToken.symbol || "";
        if (supabaseToken.parent_address) {
            explorerLink.style.display = "inline";
            explorerLink.href = `https://midgard.wtf/token/${supabaseToken.parent_address}`;
        } else {
            explorerLink.style.display = "none";
        }
        if (subtitle) subtitle.textContent = "Result from Supabase (fast, accurate)";
        loading.style.display = 'none';
        return;
    }

    if (supabaseError) {
        outputDiv.style.display = "block";
        outputAddress.textContent = "Error: Could not connect to Supabase.";
        outputName.textContent = "";
        outputSymbol.textContent = "";
        explorerLink.style.display = "none";
        if (subtitle) subtitle.textContent = "Supabase error. Trying on-chain lookup...";
    }

    // Clean up address
    tokenAddress = tokenAddress.replace(/[\s\u200B-\u200D\uFEFF]/g, '');

    if (typeof ethers === "undefined") {
        loading.style.display = 'none';
        alert("ethers.js not loaded.");
        return;
    }
    if (!ethers.utils.isAddress(tokenAddress)) {
        try {
            tokenAddress = ethers.utils.getAddress(tokenAddress);
            console.log("Checksummed address:", tokenAddress);
        } catch {
            loading.style.display = 'none';
            alert("Invalid address format. Please check for typos or extra spaces.");
            return;
        }
    }

    // On-chain lookup
    try {
        loading.textContent = 'Searching on-chain...';
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
            if (subtitle) subtitle.textContent = "Result from on-chain lookup (slower, may be incomplete)";
        } else {
            outputAddress.textContent = "No parent found";
            outputName.textContent = "";
            outputSymbol.textContent = "";
            explorerLink.style.display = "none";
            if (subtitle) subtitle.textContent = "No parent found for this token.";
        }
    } catch (err) {
        outputDiv.style.display = "block";
        outputAddress.textContent = "Error: " + (err.message || "Could not query parent token.");
        outputName.textContent = "";
        outputSymbol.textContent = "";
        explorerLink.style.display = "none";
        if (subtitle) subtitle.textContent = "Error during on-chain lookup.";
        console.error("Error querying parent token:", err);
    } finally {
        loading.style.display = 'none';
    }
}