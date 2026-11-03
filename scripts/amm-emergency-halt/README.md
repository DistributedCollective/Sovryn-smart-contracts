# AMM emergency halt implementation

`AMMEmergencyHalt` is a dedicated, storage-free clone of the Zero emergency
halt pattern. Every call, including empty calldata and native-value calls,
reverts with `AMM: emergency shutdown`. The message is fixed in bytecode;
there are no constructor arguments, initializer, selectors or mutable state.
Native administration on a delegating proxy remains controlled by that proxy.

On Rootstock mainnet, this command checks the pinned address/runtime and reuses
the existing deployment. The deployment function sends no transaction and does
not request a signing account; a missing or mismatched record/runtime is an error:

```sh
npx hardhat deploy --tags AMMEmergencyHalt --network rskSovrynMainnet
```

The implementation is deployed at `0x8c293ed020f4d7321b6b16c71584fddb560e0ebd`
and fully source-verified on Rootstock Blockscout. Runtime: 119 bytes; Keccak256:
`0x8ec8ffa2692ec6859263b043a1494bf41561e8a526d3d9555eb3ac3bba85c7ae`.
The current SIP manifest binds this address/hash instead of DummyMoCMedianizer.
Deployment alone changes no AMM configuration. The immutable published SIP and
verified targets are finalized for read-only production preparation; proposal
creation remains an owner action. Reuse the deployed implementation;
there is no need to redeploy it.

On other networks, the same deployment tag retains the ordinary no-argument
deployment behavior through the configured Hardhat signer.
