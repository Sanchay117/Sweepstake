// Portaldot V3 gives every Ethereum address a native twin, and every native account an address.
import { getAddress, getBytes, hexlify, keccak256 } from "ethers";

/** A MetaMask key's native account: the address followed by twelve 0xEE bytes. */
export function evmToAccountHex(address) {
  return `${address.toLowerCase()}${"ee".repeat(12)}`;
}

/** The address Solidity sees for a native account. */
export function accountToEvm(accountHex) {
  const hex = accountHex.toLowerCase();
  if (hex.endsWith("ee".repeat(12))) return getAddress(hex.slice(0, 42));
  return getAddress(hexlify(getBytes(keccak256(hex)).slice(12)));
}
