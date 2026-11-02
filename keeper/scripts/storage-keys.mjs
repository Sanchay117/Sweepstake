// Prints the raw storage keys the website reads, so it needs no polkadot.js and no backend.
import { xxhashAsHex } from "@polkadot/util-crypto";

const prefix = (pallet, item) => xxhashAsHex(pallet, 128) + xxhashAsHex(item, 128).slice(2);

console.log("POOL_MEMBERS", prefix("NominationPools", "PoolMembers"));
console.log("ACTIVE_ERA", prefix("Staking", "ActiveEra"));
console.log("LAST_POOL_ID", prefix("NominationPools", "LastPoolId"));
console.log("SYSTEM_ACCOUNT", prefix("System", "Account"));
console.log("ERAS_TOTAL_STAKE", prefix("Staking", "ErasTotalStake"));
console.log("ERAS_VALIDATOR_REWARD", prefix("Staking", "ErasValidatorReward"));
