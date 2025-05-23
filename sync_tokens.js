// sync_tokens.js
//
// Script to regularly sync token data from the blockchain into the Supabase database.
// - Connects to Supabase
// - Fetches token data from the blockchain (via API or node access)
// - Validates parent_address relationships before insertion
// - Inserts or updates tokens in the "tokens" table
// - Handles errors and ensures data consistency
//
// Usage:
//   1. Set SUPABASE_URL and SUPABASE_KEY as environment variables.
//   2. Adjust BLOCKCHAIN_API_URL and fetchBlockchainTokens() as needed.
//   3. Run: node sync_tokens.js
//
// Requirements:
//   npm install @supabase/supabase-js node-fetch

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// --- CONFIGURATION ---

const SUPABASE_URL = 'https://zitdqmwrgignwqwjreae.supabase.co'; // <-- Paste your Supabase URL here as a string
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdGRxbXdyZ2lnbndxd2pyZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzMzExODYsImV4cCI6MjA2MTkwNzE4Nn0.9qz8wH4haWaGT4VG5yJEb93BKRQDcJZEbaXVCVm4NFQ'; // <-- Paste your Supabase service role key here as a string
const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjJhYmNhMTNlLWMxNDctNDgxMS1iMDM0LWYwZWYyMThjN2ZmYSIsIm9yZ0lkIjoiNDA2NzE0IiwidXNlcklkIjoiNDE3OTIxIiwidHlwZUlkIjoiNWRlMmY3ZjItOTFhYi00ZDcwLWE2NWMtMzE4YzRiNGEzZDdlIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3MjUyNDI2MjcsImV4cCI6NDg4MTAwMjYyN30.Lgd2uf2THIfw_R-DJuqApI6wnNEjqyuAgYKMjyiGwWk'; // <-- Paste your Moralis API key here as a string
const PULSECHAIN_CHAIN = 'pulsechain'; // Moralis chain name for PulseChain

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set as environment variables or hardcoded in the script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- FETCH TOKEN DATA FROM BLOCKCHAIN ---

/**
 * Fetches token data from Moralis Web3 Data API for PulseChain.
 * Returns an array of token objects with address, name, symbol, and parent_address (null).
 * Adjust the endpoint and mapping as needed for your use case.
 */
/**
 * Fetches token data from Moralis Web3 Data API for PulseChain.
 * Returns an array of token objects with address, name, symbol, and parent_address (null).
 * Adjust the endpoint and mapping as needed for your use case.
 */
async function fetchBlockchainTokens() {
  try {
    // Fetch all ERC20 tokens on PulseChain (Moralis API)
    // See: https://docs.moralis.io/web3-data-api/evm/reference/get-erc20-tokens
    const url = `https://deep-index.moralis.io/api/v2.2/erc20/tokens?chain=${PULSECHAIN_CHAIN}&limit=100`;

    const response = await fetch(url, {
      headers: {
        'X-API-Key': MORALIS_API_KEY
      }
    });

    if (!response.ok) throw new Error(`Moralis API error: ${response.statusText}`);
    const data = await response.json();

    // Map Moralis response to our token schema
    if (!Array.isArray(data.result)) {
      console.error('Unexpected Moralis API response:', data);
      return [];
    }

    return data.result.map(token => ({
      address: token.token_address,
      name: token.name,
      symbol: token.symbol,
      parent_address: null // Moralis does not provide parent-child, set to null
    }));
  } catch (error) {
    console.error('Failed to fetch tokens from Moralis:', error);
    return [];
  }
}

// --- VALIDATE PARENT ADDRESS ---

/**
 * Checks if a parent_address exists in the tokens table.
 * Returns true if valid or null/undefined, false otherwise.
 */
async function isValidParentAddress(parent_address) {
  if (!parent_address) return true; // No parent, valid
  const { data, error } = await supabase
    .from('tokens')
    .select('address')
    .eq('address', parent_address)
    .single();
  if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
    console.error('Error checking parent_address:', error);
    return false;
  }
  return !!data;
}

// --- UPSERT TOKENS ---

/**
 * Inserts or updates a token in the tokens table.
 */
async function upsertToken(token) {
  try {
    const { data, error } = await supabase
      .from('tokens')
      .upsert(token, { onConflict: ['address'] });
    if (error) {
      console.error(`Failed to upsert token ${token.address}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Exception during upsert for token ${token.address}:`, err);
    return false;
  }
}

// --- MAIN SYNC FUNCTION ---

async function syncTokens() {
  console.log('Starting token sync...');
  const tokens = await fetchBlockchainTokens();
  let successCount = 0;
  let skippedCount = 0;

  for (const token of tokens) {
    // Validate parent_address
    const validParent = await isValidParentAddress(token.parent_address);
    if (!validParent) {
      console.warn(`Skipping token ${token.address}: invalid parent_address ${token.parent_address}`);
      skippedCount++;
      continue;
    }
    // Upsert token
    const success = await upsertToken(token);
    if (success) successCount++;
  }

  console.log(`Sync complete. ${successCount} tokens upserted, ${skippedCount} skipped.`);
}

// --- ERROR HANDLING & SCHEDULING ---

async function main() {
  try {
    await syncTokens();
  } catch (err) {
    console.error('Unexpected error during sync:', err);
  }
}

// Run immediately; for regular sync, use a scheduler (e.g., cron) to run this script.
main();