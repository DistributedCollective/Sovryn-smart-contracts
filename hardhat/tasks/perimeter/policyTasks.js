const { task, types } = require("hardhat/config");
const Logs = require("node-logs");
const {
    sendWithMultisigReturningId,
    multisigCheckTx,
} = require("../../../deployment/helpers/helpers");
const policy = require("./policy");
const { resolveOptionalAddress } = require("./addressParam");

const logger = new Logs().showInConsole(true);

/**
 * Owner/admin tasks for the ExitFeeController's Perimeter fee entries and
 * delay-bypass exemptions, every write going through the Exchequer multisig.
 *
 * The controller lives in a different repository and is an INPUT to this
 * repo, not something it deploys — resolution below tries, in order, an
 * explicit `--controller`, a saved `ExitFeeController` deployment record
 * (fork/QA tests save one), and finally the protocol's own pointer to it.
 * The live controller is an ERC-1967 proxy, so whether the fee-only build or
 * the one that also carries the withdrawal delay is installed cannot be read
 * off the controller address's own bytecode — a proxy's code never contains
 * any of the implementation's selectors. `attachController` resolves the
 * ERC-1967 implementation slot first, and decides the build from the
 * IMPLEMENTATION's bytecode: the delay build's code contains the selector of
 * `securityPerimeterEnabled()`, the fee-only build's does not (see
 * `policy.buildFromCode`, `policy.implementationFromSlot`).
 */

const resolveControllerAddress = async (hre, controllerParam) => {
    const {
        ethers: hreEthers,
        deployments: { getOrNull, get },
    } = hre;
    return resolveOptionalAddress(hreEthers, controllerParam, async () => {
        const record = await getOrNull("ExitFeeController");
        if (record) return record.address;

        const protocolRecord = await get("ISovryn");
        const protocol = await hreEthers.getContractAt(
            ["function exitFeeController() view returns (address)"],
            protocolRecord.address
        );
        const pointer = await protocol.exitFeeController();
        if (pointer === hreEthers.constants.AddressZero) {
            throw new Error(
                "the protocol's exitFeeController pointer is the zero address — no controller " +
                    "is installed on this network"
            );
        }
        return pointer;
    });
};

/** The ERC-1967 storage slot that holds a UUPS/Transparent proxy's
 *  implementation address (keccak256("eip1967.proxy.implementation") - 1). */
const ERC1967_IMPLEMENTATION_SLOT =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

/**
 * Resolve the controller, refuse an empty-code address, and decide the build
 * from the IMPLEMENTATION's bytecode (`policy.buildFromCode`) — the live
 * controller is an ERC-1967 proxy, and a proxy's own bytecode never contains
 * any of the implementation's selectors, so the selector check has to run
 * against whatever the ERC-1967 implementation slot names. When that slot
 * reads zero the address is not a proxy at all, and its own code is the
 * implementation. Either way this is a positive check, not a try/catch
 * around a call: a network error or a revert propagates as an error instead
 * of silently reading as "fee-only", which would make `perimeter:exemption
 * --action revoke` clear only the fee half while looking like it cleared
 * both.
 */
const attachController = async (hre, controllerParam) => {
    const { provider } = hre.ethers;
    const address = await resolveControllerAddress(hre, controllerParam);
    const proxyCode = await provider.getCode(address);
    if (proxyCode === "0x") {
        throw new Error(`no contract code at the controller ${address}`);
    }

    const slotValue = await provider.getStorageAt(address, ERC1967_IMPLEMENTATION_SLOT);
    const proxyTarget = policy.implementationFromSlot(slotValue);
    const implementation = proxyTarget || address;
    const implementationCode = proxyTarget ? await provider.getCode(proxyTarget) : proxyCode;
    if (implementationCode === "0x") {
        throw new Error(`no contract code at the implementation ${implementation}`);
    }

    const controller = await hre.ethers.getContractAt(policy.CONTROLLER_ABI, address);
    return {
        address,
        implementation,
        controller,
        build: policy.buildFromCode(implementationCode),
    };
};

const resolveMultisigAddress = async (hre, multisigParam) => {
    const {
        ethers: hreEthers,
        deployments: { get },
    } = hre;
    return resolveOptionalAddress(
        hreEthers,
        multisigParam,
        async () => (await get("MultiSigWallet")).address
    );
};

const resolveSigner = async (hre, signerParam) => {
    const { ethers: hreEthers } = hre;
    return hreEthers.utils.isAddress(signerParam)
        ? signerParam
        : (await hre.getNamedAccounts())[signerParam];
};

/**
 * The checks a sub-product target must pass before `perimeter:fee:set` or
 * `perimeter:fee:remove` will touch its entry: the surface must have a
 * sub-product tier at all (the two Zero surfaces don't — they key on nothing,
 * not a pool), and the address must actually be a contract. Shared so the two
 * tasks can't drift apart on what counts as a valid sub-product.
 */
const requireSubProductTarget = async (hre, resolvedSurface, subproductInput, taskLabel) => {
    const { ethers: hreEthers } = hre;
    if (policy.SURFACES_WITHOUT_SUBPRODUCT.has(resolvedSurface.name)) {
        throw new Error(
            `${taskLabel}: ${resolvedSurface.name} has no sub-product tier — Zero withdrawals ` +
                "are not keyed on a pool"
        );
    }
    const address = hreEthers.utils.getAddress(subproductInput);
    if ((await hreEthers.provider.getCode(address)) === "0x") {
        throw new Error(`${taskLabel}: no contract code at sub-product ${address}`);
    }
    return address;
};

const presentCall = (controllerAddress, built, note) => {
    const decoded = policy.decodeCall(built.data);
    logger.info(`  target:    ${controllerAddress}`);
    logger.info(`  signature: ${built.signature}`);
    logger.info(
        `  args:      ${decoded ? decoded.args.map(policy.stringifyArg).join(", ") : "(n/a)"}`
    );
    logger.info(`  meaning:   ${built.meaning}${note ? ` — ${note}` : ""}`);
    logger.info(`  calldata:  ${built.data}`);
};

const submitPlannedCall = async (
    hre,
    { multisigAddress, controllerAddress, signerAcc, built }
) => {
    const txId = await sendWithMultisigReturningId(
        multisigAddress,
        controllerAddress,
        built.data,
        signerAcc
    );
    logger.info(`  submitted as multisig transaction ${txId}`);
    return txId;
};

task(
    "perimeter:policy:show",
    "Print the ExitFeeController's Perimeter fee (and, on the delay build, delay) policy"
)
    .addOptionalParam(
        "controller",
        "ExitFeeController address (defaults to the deployment record or the protocol pointer)"
    )
    .addOptionalParam(
        "surface",
        "Only this surface (name, suffix, or id) — default: every surface"
    )
    .addOptionalParam("actor", "Also print this actor's resolved quote and delay entry")
    .addOptionalParam("subproduct", "Sub-product to quote for (with --actor); default: none")
    .setAction(async ({ controller, surface, actor, subproduct }, hre) => {
        const { ethers: hreEthers } = hre;
        const {
            address: controllerAddress,
            implementation,
            controller: controllerContract,
            build,
        } = await attachController(hre, controller);

        const enabled = await controllerContract.exitFeeEnabled();
        const receiver = await controllerContract.feeReceiver();

        logger.info(`Controller:   ${controllerAddress} — implementation: ${implementation}`);
        logger.info(`Fee switch:   ${enabled ? "on" : "off"}`);
        logger.info(`Fee receiver: ${receiver}`);
        if (build === "delay") {
            const armed = await controllerContract.securityPerimeterEnabled();
            const delaySeconds = await controllerContract.globalDelaySeconds();
            logger.info(
                `Build:        delay (switch ${armed ? "on" : "off"}, length ${delaySeconds}s)`
            );
        } else {
            logger.info("Build:        fee-only");
        }

        // Only an OMITTED --actor/--subproduct/--surface may fall through to
        // the "not given" default below; an explicitly-supplied empty value
        // (e.g. an unset shell variable interpolated into a wrapper script)
        // must refuse rather than silently widen a one-address/one-pool/
        // one-surface inspection into the "every surface" default listing.
        const actorAddress = actor !== undefined ? hreEthers.utils.getAddress(actor) : undefined;
        const subProductAddress =
            subproduct !== undefined ? hreEthers.utils.getAddress(subproduct) : undefined;

        let surfaceNames;
        if (surface !== undefined) {
            // Inspection-only path: an operator who already suspects an
            // unlisted surface can ask to see it directly.
            surfaceNames = [
                policy.resolveSurface(surface, { allowUnknown: true }).name || surface,
            ];
        } else {
            // The fee-only build has no bypass concept, so it carries no
            // bypassSurfaceIds() to union in beyond the five known names.
            const bypassIds = build === "delay" ? await controllerContract.bypassSurfaceIds() : [];
            surfaceNames = policy.defaultSurfaceNames(bypassIds);
        }

        for (const rawName of surfaceNames) {
            // rawName may be an unresolved id from the unlisted-surface
            // paths above; this is a read-only inspection loop, so it must
            // resolve one too, not just refuse it.
            const resolved = policy.resolveSurface(rawName, { allowUnknown: true });
            const id = resolved.id;
            logger.info(`Surface: ${resolved.name || rawName} (${id})`);

            const surfacePolicy = await controllerContract.surfacePolicy(id);
            logger.info(`  surface fee:   ${policy.describeFeeEntry(surfacePolicy, "surface")}`);
            if (build === "delay") {
                const surfaceBypass = await controllerContract.surfaceBypass(id);
                logger.info(
                    `  surface delay: ${policy.describeDelayEntry(surfaceBypass, "surface")}`
                );
            }

            const supportsSubProduct = !policy.SURFACES_WITHOUT_SUBPRODUCT.has(resolved.name);
            if (supportsSubProduct) {
                const subProductKeys = await controllerContract.subProductKeys(id);
                // On the delay build, a sub-product can carry an active delay
                // bypass with no fee-tier entry at all — invisible to
                // subProductKeys alone. Inventory the union of both key lists
                // so that shape is never silently skipped.
                const inventory =
                    build === "delay"
                        ? policy.unionAddresses(
                              subProductKeys,
                              await controllerContract.subProductBypassKeys(id)
                          )
                        : subProductKeys;
                for (const addr of inventory) {
                    const feeEntry = await controllerContract.subProductPolicy(id, addr);
                    let line = `  sub-product ${addr}: ${policy.describeFeeEntry(feeEntry, "sub-product")}`;
                    if (build === "delay") {
                        const bypassEntry = await controllerContract.subProductBypass(id, addr);
                        line += ` | delay: ${policy.describeDelayEntry(bypassEntry, "sub-product")}`;
                    }
                    logger.info(line);
                }
            }

            const actorKeys = await controllerContract.actorKeys(id);
            // Same gap, actor tier: the FeeSharingCollector-style exemption is
            // exactly a delay-only bypass with no fee-tier entry once its fee
            // half is removed, so actorKeys alone would make it disappear
            // from the default inventory.
            const actorInventory =
                build === "delay"
                    ? policy.unionAddresses(
                          actorKeys,
                          await controllerContract.actorBypassKeys(id)
                      )
                    : actorKeys;
            for (const addr of actorInventory) {
                const feeEntry = await controllerContract.actorPolicy(id, addr);
                let line = `  actor ${addr}: ${policy.describeFeeEntry(feeEntry, "actor")}`;
                if (build === "delay") {
                    const bypassEntry = await controllerContract.actorBypass(id, addr);
                    line += ` | delay: ${policy.describeDelayEntry(bypassEntry, "actor")}`;
                }
                logger.info(line);
            }

            if (actorAddress) {
                const quote = await controllerContract.quoteExitFee(
                    id,
                    subProductAddress || hreEthers.constants.AddressZero,
                    actorAddress,
                    hreEthers.constants.WeiPerEther
                );
                logger.info(
                    `  quote (1e18 gross, actor ${actorAddress}` +
                        `${subProductAddress ? `, sub-product ${subProductAddress}` : ""}): ` +
                        `active=${quote.active} rate=${quote.rateBps}bps fee=${quote.feeAmount.toString()} ` +
                        `net=${quote.netAmount.toString()} receiver=${quote.feeReceiver} reason=${quote.reason}`
                );
                if (build === "delay") {
                    const actorBypassEntry = await controllerContract.actorBypass(
                        id,
                        actorAddress
                    );
                    logger.info(
                        `  actor delay entry: ${policy.describeDelayEntry(actorBypassEntry, "actor")}`
                    );
                }
            }
        }
    });

task(
    "perimeter:exemption",
    "Submit or revoke a Perimeter fee/delay exemption for one actor on one surface, through the Exchequer multisig"
)
    .addParam("action", "submit | revoke", undefined, types.string)
    .addParam("surface", "Surface name, suffix, or id", undefined, types.string)
    .addParam("actor", "Actor address", undefined, types.string)
    .addOptionalParam(
        "half",
        "fee | delay | both (submit only; ignored for revoke). 'both' plans the single " +
            "atomic grantExemption call — 'fee'/'delay' alone need --confirmHalf",
        "both",
        types.string
    )
    .addFlag(
        "confirmHalf",
        "Required with --half fee or --half delay on submit: acknowledges the exemption " +
            "is left half-applied on purpose (finishing an earlier partial grant), not " +
            "granted as an ordinary two-step process"
    )
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .addOptionalParam(
        "controller",
        "ExitFeeController address (defaults to the deployment record or the protocol pointer)"
    )
    .setAction(
        async (
            { action, surface, actor, half, confirmHalf, dryRun, signer, multisig, controller },
            hre
        ) => {
            const { ethers: hreEthers } = hre;
            if (!["submit", "revoke"].includes(action)) {
                throw new Error(
                    `perimeter:exemption: --action must be 'submit' or 'revoke', got '${action}'`
                );
            }

            const resolvedSurface = policy.resolveSurface(surface);
            const actorAddress = hreEthers.utils.getAddress(actor);
            if (actorAddress === hreEthers.constants.AddressZero) {
                throw new Error("perimeter:exemption: --actor must not be the zero address");
            }

            const {
                address: controllerAddress,
                controller: controllerContract,
                build,
            } = await attachController(hre, controller);

            const surfacePolicyEntry = await controllerContract.surfacePolicy(resolvedSurface.id);
            if (!surfacePolicyEntry.active) {
                logger.warn(
                    `${resolvedSurface.name || resolvedSurface.id} is inactive — the entry this writes ` +
                        "is inert until the surface is active"
                );
            }

            const fee = await controllerContract.actorPolicy(resolvedSurface.id, actorAddress);
            const bypass =
                build === "delay"
                    ? await controllerContract.actorBypass(resolvedSurface.id, actorAddress)
                    : undefined;

            const plan =
                action === "submit"
                    ? policy.planExemption({ half, fee, bypass, build, confirmHalf })
                    : policy.planRevoke({ build, fee, bypass });

            if (plan.calls.length === 0) {
                if (action === "submit") {
                    const label = plan.alreadyDone.map((h) => `${h}-exempt`).join(" and ");
                    logger.info(`already ${label}, nothing to submit`);
                } else {
                    logger.info("already withdrawn, nothing to submit");
                }
                return;
            }

            const multisigAddress = await resolveMultisigAddress(hre, multisig);
            const signerAcc = await resolveSigner(hre, signer);

            logger.info(`Controller: ${controllerAddress}`);
            logger.info(`Surface:    ${resolvedSurface.name || resolvedSurface.id}`);
            logger.info(`Actor:      ${actorAddress}`);
            logger.info(`Build:      ${build}`);
            logger.info(`Multisig:   ${multisigAddress}`);
            logger.info(`Submitter:  ${signerAcc}`);

            for (const call of plan.calls) {
                const built = policy.buildCall(call.kind, {
                    surface: resolvedSurface,
                    actor: actorAddress,
                    rate: call.rate,
                    bypass: call.bypass,
                });
                presentCall(controllerAddress, built, call.note);
                if (!dryRun) {
                    await submitPlannedCall(hre, {
                        multisigAddress,
                        controllerAddress,
                        signerAcc,
                        built,
                    });
                }
            }

            if (!dryRun) {
                logger.info(
                    "Read back once every call above has executed with " +
                        `\`npx hardhat perimeter:policy:show --network ${hre.network.name} ` +
                        `--controller ${controllerAddress} --surface ${resolvedSurface.name || resolvedSurface.id} ` +
                        `--actor ${actorAddress}\`.`
                );
            }
        }
    );

task(
    "perimeter:fee:set",
    "Set a Perimeter fee entry (surface, sub-product, or actor tier), through the Exchequer multisig"
)
    .addParam("surface", "Surface name, suffix, or id", undefined, types.string)
    .addOptionalParam("subproduct", "Sub-product address (mutually exclusive with --actor)")
    .addOptionalParam("actor", "Actor address (mutually exclusive with --subproduct)")
    .addParam("rate", "Rate in bps, 0..10000, or 'inactive'", undefined, types.string)
    .addFlag(
        "confirmFeeOnly",
        "Required when this would leave the actor fee-exempt with no active delay bypass: " +
            "acknowledges the actor is held but not charged, on purpose"
    )
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .addOptionalParam(
        "controller",
        "ExitFeeController address (defaults to the deployment record or the protocol pointer)"
    )
    .setAction(
        async (
            {
                surface,
                subproduct,
                actor,
                rate,
                confirmFeeOnly,
                dryRun,
                signer,
                multisig,
                controller,
            },
            hre
        ) => {
            const { ethers: hreEthers } = hre;
            // Only an OMITTED --subproduct/--actor may fall through to the
            // implicit "surface" tier below; an explicitly-supplied empty
            // value (e.g. an unset shell variable) must refuse rather than
            // silently widen the change from one pool/actor to the whole
            // surface.
            if (subproduct !== undefined && actor !== undefined) {
                throw new Error("perimeter:fee:set: pass --subproduct or --actor, not both");
            }

            const resolvedSurface = policy.resolveSurface(surface);
            const parsedRate = policy.parseRate(rate);
            const {
                address: controllerAddress,
                controller: controllerContract,
                build,
            } = await attachController(hre, controller);

            let kind;
            let tier;
            let address;
            if (subproduct !== undefined) {
                address = await requireSubProductTarget(
                    hre,
                    resolvedSurface,
                    subproduct,
                    "perimeter:fee:set"
                );
                kind = "setSubProductPolicy";
                tier = "sub-product";
            } else if (actor !== undefined) {
                address = hreEthers.utils.getAddress(actor);
                if (address === hreEthers.constants.AddressZero) {
                    throw new Error("perimeter:fee:set: --actor must not be the zero address");
                }
                kind = "setActorPolicy";
                tier = "actor";
            } else {
                kind = "setSurfacePolicy";
                tier = "surface";
            }

            if (tier === "actor" && build === "delay") {
                const bypass = await controllerContract.actorBypass(resolvedSurface.id, address);
                const divergence = policy.actorFeeDelayDivergence({
                    build,
                    resultFee: parsedRate,
                    bypass,
                });
                if (divergence === "charged") {
                    throw new Error(
                        `perimeter:fee:set: ${address} still carries an active delay bypass on ` +
                            `${policy.surfaceLabel(resolvedSurface.id)} — this fee would leave ` +
                            "it charged but not held. `perimeter:exemption --action revoke` is " +
                            "the call that withdraws both halves."
                    );
                }
                if (divergence === "held" && !confirmFeeOnly) {
                    throw new Error(
                        `perimeter:fee:set: this leaves ${address} fee-exempt on ` +
                            `${policy.surfaceLabel(resolvedSurface.id)} with no active delay ` +
                            "bypass — held, not charged, on its own. Pass --confirmFeeOnly to " +
                            "submit anyway, or use `perimeter:exemption --action submit` to " +
                            "grant the full exemption."
                    );
                }
            }

            const current =
                tier === "surface"
                    ? await controllerContract.surfacePolicy(resolvedSurface.id)
                    : tier === "sub-product"
                      ? await controllerContract.subProductPolicy(resolvedSurface.id, address)
                      : await controllerContract.actorPolicy(resolvedSurface.id, address);

            if (
                current.active === parsedRate.active &&
                Number(current.rateBps) === parsedRate.rateBps
            ) {
                logger.info(
                    `already ${policy.describeFeeEntry(current, tier)}, nothing to submit`
                );
                return;
            }

            if (tier !== "surface") {
                const surfaceEntry = await controllerContract.surfacePolicy(resolvedSurface.id);
                if (!surfaceEntry.active) {
                    logger.warn(
                        `${resolvedSurface.name || resolvedSurface.id} is inactive — the entry is written ` +
                            "but inert until the surface is active"
                    );
                }
            }
            if (tier === "surface" && !parsedRate.active) {
                logger.warn(
                    "this turns the Perimeter fee off for the whole surface, whatever the pool and actor entries say"
                );
            }

            const built = policy.buildCall(kind, {
                surface: resolvedSurface,
                subProduct: tier === "sub-product" ? address : undefined,
                actor: tier === "actor" ? address : undefined,
                rate: parsedRate,
            });

            const multisigAddress = await resolveMultisigAddress(hre, multisig);
            const signerAcc = await resolveSigner(hre, signer);
            logger.info(`Multisig:  ${multisigAddress}`);
            logger.info(`Submitter: ${signerAcc}`);
            presentCall(controllerAddress, built);
            if (!dryRun) {
                await submitPlannedCall(hre, {
                    multisigAddress,
                    controllerAddress,
                    signerAcc,
                    built,
                });
            }
        }
    );

task(
    "perimeter:fee:remove",
    "Remove a sub-product or actor Perimeter fee entry, through the Exchequer multisig"
)
    .addParam("surface", "Surface name, suffix, or id", undefined, types.string)
    .addOptionalParam("subproduct", "Sub-product address (mutually exclusive with --actor)")
    .addOptionalParam("actor", "Actor address (mutually exclusive with --subproduct)")
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .addOptionalParam(
        "controller",
        "ExitFeeController address (defaults to the deployment record or the protocol pointer)"
    )
    .setAction(
        async ({ surface, subproduct, actor, dryRun, signer, multisig, controller }, hre) => {
            const { ethers: hreEthers } = hre;
            // As in fee:set, only an OMITTED flag counts as "not given" —
            // an explicitly-supplied empty --subproduct/--actor must refuse
            // rather than being read as the other one alone.
            if ((subproduct !== undefined) === (actor !== undefined)) {
                throw new Error(
                    "perimeter:fee:remove: pass exactly one of --subproduct or --actor"
                );
            }

            const resolvedSurface = policy.resolveSurface(surface);
            const {
                address: controllerAddress,
                controller: controllerContract,
                build,
            } = await attachController(hre, controller);

            let tier;
            let kind;
            let address;
            if (subproduct !== undefined) {
                address = await requireSubProductTarget(
                    hre,
                    resolvedSurface,
                    subproduct,
                    "perimeter:fee:remove"
                );
                tier = "sub-product";
                kind = "removeSubProductPolicy";
            } else {
                address = hreEthers.utils.getAddress(actor);
                if (address === hreEthers.constants.AddressZero) {
                    throw new Error("perimeter:fee:remove: --actor must not be the zero address");
                }
                tier = "actor";
                kind = "removeActorPolicy";
            }

            if (tier === "actor" && build === "delay") {
                const bypass = await controllerContract.actorBypass(resolvedSurface.id, address);
                // Removal always leaves the fee entry inactive, never exempt
                // — the only divergence this can ever produce is "charged":
                // an active bypass surviving the removal. There is no
                // opposite, harmless direction here to gate behind a flag.
                const divergence = policy.actorFeeDelayDivergence({
                    build,
                    resultFee: { active: false, rateBps: 0 },
                    bypass,
                });
                if (divergence === "charged") {
                    throw new Error(
                        `perimeter:fee:remove: ${address} still carries an active delay bypass ` +
                            `on ${policy.surfaceLabel(resolvedSurface.id)} — removing the fee ` +
                            "entry would leave it charged the default fee but not held. " +
                            "`perimeter:exemption --action revoke` is the call that withdraws " +
                            "both halves."
                    );
                }
            }

            const entry =
                tier === "sub-product"
                    ? await controllerContract.subProductPolicy(resolvedSurface.id, address)
                    : await controllerContract.actorPolicy(resolvedSurface.id, address);
            const keys =
                tier === "sub-product"
                    ? await controllerContract.subProductKeys(resolvedSurface.id)
                    : await controllerContract.actorKeys(resolvedSurface.id);
            const present = keys.map((k) => k.toLowerCase()).includes(address.toLowerCase());

            if (!entry.active && !present) {
                logger.info("already inactive and absent from the key set, nothing to submit");
                return;
            }

            const built = policy.buildCall(kind, {
                surface: resolvedSurface,
                subProduct: tier === "sub-product" ? address : undefined,
                actor: tier === "actor" ? address : undefined,
            });

            const multisigAddress = await resolveMultisigAddress(hre, multisig);
            const signerAcc = await resolveSigner(hre, signer);
            logger.info(`Multisig:  ${multisigAddress}`);
            logger.info(`Submitter: ${signerAcc}`);
            presentCall(controllerAddress, built);
            if (!dryRun) {
                await submitPlannedCall(hre, {
                    multisigAddress,
                    controllerAddress,
                    signerAcc,
                    built,
                });
            }
        }
    );

task(
    "perimeter:fee:switch",
    "Switch the Perimeter fee on or off for every surface, through the Exchequer multisig"
)
    .addParam("state", "on | off", undefined, types.string)
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .addOptionalParam(
        "controller",
        "ExitFeeController address (defaults to the deployment record or the protocol pointer)"
    )
    .setAction(async ({ state, dryRun, signer, multisig, controller }, hre) => {
        if (!["on", "off"].includes(state)) {
            throw new Error(`perimeter:fee:switch: --state must be 'on' or 'off', got '${state}'`);
        }
        const desired = state === "on";
        const { address: controllerAddress, controller: controllerContract } =
            await attachController(hre, controller);
        const current = await controllerContract.exitFeeEnabled();
        if (current === desired) {
            logger.info(`already ${state}, nothing to submit`);
            return;
        }
        if (!desired) {
            logger.warn("this stops the Perimeter fee on every surface");
        }

        const built = policy.buildCall("setExitFeeEnabled", { enabled: desired });
        const multisigAddress = await resolveMultisigAddress(hre, multisig);
        const signerAcc = await resolveSigner(hre, signer);
        logger.info(`Multisig:  ${multisigAddress}`);
        logger.info(`Submitter: ${signerAcc}`);
        presentCall(controllerAddress, built);
        if (!dryRun) {
            await submitPlannedCall(hre, { multisigAddress, controllerAddress, signerAcc, built });
        }
    });

task("perimeter:fee:receiver", "Set the Perimeter fee receiver, through the Exchequer multisig")
    .addParam("address", "New fee receiver address", undefined, types.string)
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .addOptionalParam(
        "controller",
        "ExitFeeController address (defaults to the deployment record or the protocol pointer)"
    )
    .setAction(async ({ address, dryRun, signer, multisig, controller }, hre) => {
        const { ethers: hreEthers } = hre;
        const newReceiver = hreEthers.utils.getAddress(address);
        if (newReceiver === hreEthers.constants.AddressZero) {
            throw new Error("perimeter:fee:receiver: --address must not be the zero address");
        }

        const { address: controllerAddress, controller: controllerContract } =
            await attachController(hre, controller);
        const current = await controllerContract.feeReceiver();
        if (current.toLowerCase() === newReceiver.toLowerCase()) {
            logger.info(`already ${current}, nothing to submit`);
            return;
        }

        const built = policy.buildCall("setFeeReceiver", { address: newReceiver });
        const multisigAddress = await resolveMultisigAddress(hre, multisig);
        const signerAcc = await resolveSigner(hre, signer);
        logger.info(`Multisig:  ${multisigAddress}`);
        logger.info(`Submitter: ${signerAcc}`);
        presentCall(controllerAddress, built);
        if (!dryRun) {
            await submitPlannedCall(hre, { multisigAddress, controllerAddress, signerAcc, built });
        }
    });

task(
    "perimeter:policy:check-tx",
    "Decode a submitted controller-policy transaction and refuse to bless anything it cannot vouch for"
)
    .addParam("id", "Multisig transaction id", undefined, types.string)
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .addOptionalParam(
        "controller",
        "ExitFeeController address (defaults to the deployment record or the protocol pointer)"
    )
    .setAction(async ({ id, multisig, controller }, hre) => {
        const { ethers: hreEthers } = hre;
        const multisigAddress = await resolveMultisigAddress(hre, multisig);
        const {
            address: controllerAddress,
            controller: controllerContract,
            build,
        } = await attachController(hre, controller);

        const ms = await hreEthers.getContractAt("MultiSigWallet", multisigAddress);
        const tx = await ms.transactions(id);

        logger.info(`Target:   ${tx.destination}`);
        logger.info(`Executed: ${tx.executed}`);

        if (tx.destination.toLowerCase() !== controllerAddress.toLowerCase()) {
            throw new Error(
                `perimeter:policy:check-tx: transaction ${id} targets ${tx.destination}, not the ` +
                    `controller ${controllerAddress} — refusing to describe it as a controller call`
            );
        }

        // A controller policy call never moves value. Non-zero here means
        // this transaction does something check-tx cannot see in the
        // decoded call alone — refuse rather than silently ignore it.
        if (!tx.value.isZero()) {
            throw new Error(
                `perimeter:policy:check-tx: transaction ${id} carries non-zero value ` +
                    `(${tx.value.toString()}) to the controller — a policy call never does; ` +
                    "refusing to describe this as safe to confirm"
            );
        }

        const decoded = policy.decodeCall(tx.data);
        if (!decoded) {
            throw new Error(
                `perimeter:policy:check-tx: transaction ${id}'s calldata does not decode as any ` +
                    "known controller policy call - refusing to describe an unrecognized call as " +
                    "safe to confirm. If this selector is expected (a controller upgrade added " +
                    "one), extend policy.CONTROLLER_ABI/CALL_DEFS first."
            );
        }
        logger.info(`Call:     ${decoded.signature} — ${decoded.meaning}`);

        if (build === "delay" && policy.ACTOR_TIER_PAIR_CALLS.has(decoded.kind)) {
            const surfaceIdArg = decoded.args[0];
            const actorArg = decoded.args[1];
            const currentFee = await controllerContract.actorPolicy(surfaceIdArg, actorArg);
            const currentBypass = await controllerContract.actorBypass(surfaceIdArg, actorArg);
            const violates = policy.pairingViolationAfterCall({
                kind: decoded.kind,
                args: decoded.args,
                currentFee,
                currentBypass,
            });
            if (violates === true) {
                logger.warn(
                    `Pairing:  executing this leaves ${actorArg} half-applied on ` +
                        `${policy.surfaceLabel(surfaceIdArg)} - one of fee-exempt/delay-bypassed ` +
                        "without the other. Confirming this alone does not finish an exemption."
                );
            } else if (violates === false) {
                logger.info(
                    "Pairing:  fee and delay stay matched for this actor after this call."
                );
            }
        }

        await multisigCheckTx(id, multisigAddress);
    });
