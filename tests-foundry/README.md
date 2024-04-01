## How To
### Run all the forge tests
```
forge test
```

### Run a specific test
**Examples**  
```
forge test --match-path */staking/StakingStake.t.sol --match-test testFuzz_Withdraw -vvv
```

```
forge test --match-contract SafeDepositsSenderTest -vvv
```

*-vvv is verbosity level, it is the most optimal if having failing tests*