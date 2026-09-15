const { task, types } = require("hardhat/config");
const Logs = require("node-logs");
const {
    sendWithMultisigReturningId,
    multisigCheckTx,
} = require("../../../deployment/helpers/helpers");
const policy = require("./policy");

const logger = new Logs().showInConsole(true);

/**
 * Owner/admin tasks for the ExitFeeController's Perimeter fee entries and
 * delay-bypass exemptions, every write going through the Exchequer multisig.
 *
 * The controller lives in a different repository and is an INPUT to this
 * repo, not something it deploys — resolution below tries, in order, an
 * explicit `--controller`, a saved `ExitFeeController` deployment record
 * (fork/QA tests save one), and finally the protocol's own pointer to it.
 * Whether the deployed controller is the fee-only build or the one that also
 * carries the withdrawal delay is decided from its deployed bytecode: the
 * delay build's code contains the selector of `securityPerimeterEnabled()`,
 * the fee-only build's does not (see `policy.buildFromCode`).
 */

const resolveControllerAddress = async (hre, controllerParam) => {
    const {
        ethers: hreEthers,
        deployments: { getOrNull, get },
    } = hre;
    if (controllerParam) {
        if (!hreEthers.utils.isAddress(controllerParam)) {
            throw new Error(`'${controllerParam}' is not an address`);
        }
        return hreEthers.utils.getAddress(controllerParam);
    }

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
            "the protocol's exitFeeController pointer is the zero address — no controller is " +
                "installed on this network"
        );
    }
    return pointer;
};

/**
 * Resolve the controller, refuse an empty-code address, and decide the build
 * from that same bytecode read (`policy.buildFromCode`) — a positive check,
 * not a try/catch around a call. A network error or a revert on
 * `securityPerimeterEnabled()` propagates as an error instead of silently
 * reading as "fee-only", which would make `perimeter:exemption --action
 * revoke` clear only the fee half while looking like it cleared both.
 */
const attachController = async (hre, controllerParam) => {
    const address = await resolveControllerAddress(hre, controllerParam);
    const code = await hre.ethers.provider.getCode(address);
    if (code === "0x") {
        throw new Error(`no contract code at the controller ${address}`);
    }
    const controller = await hre.ethers.getContractAt(policy.CONTROLLER_ABI, address);
    return { address, controller, build: policy.buildFromCode(code) };
};

const resolveMultisigAddress = async (hre, multisigParam) => {
    const {
        ethers: hreEthers,
        deployments: { get },
    } = hre;
    if (multisigParam) {
        if (!hreEthers.utils.isAddress(multisigParam)) {
            throw new Error(`'${multisigParam}' is not an address`);
        }
        return hreEthers.utils.getAddress(multisigParam);
    }
    return (await get("MultiSigWallet")).address;
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

/** Render a decoded arg for display: tuples as "(a, b)", everything else via
 *  its own string form (works for addresses, hex ids, bools and BigNumbers alike). */
const stringifyArg = (value) => {
    if (Array.isArray(value)) {
        return `(${value.map(stringifyArg).join(", ")})`;
    }
    if (value && typeof value === "object" && typeof value.toString === "function") {
        return value.toString();
    }
    return String(value);
};

const presentCall = (controllerAddress, built, note) => {
    const decoded = policy.decodeCall(built.data);
    logger.info(`  target:    ${controllerAddress}`);
    logger.info(`  signature: ${built.signature}`);
    logger.info(`  args:      ${decoded ? decoded.args.map(stringifyArg).join(", ") : "(n/a)"}`);
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
            controller: controllerContract,
            build,
        } = await attachController(hre, controller);

        const enabled = await controllerContract.exitFeeEnabled();
        const receiver = await controllerContract.feeReceiver();

        logger.info(`Controller:   ${controllerAddress}`);
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

        const actorAddress = actor ? hreEthers.utils.getAddress(actor) : undefined;
        const subProductAddress = subproduct ? hreEthers.utils.getAddress(subproduct) : undefined;

        const surfaceNames = surface
            ? [policy.resolveSurface(surface).name || surface]
            : Object.keys(policy.SURFACES);

        for (const rawName of surfaceNames) {
            const resolved = policy.resolveSurface(rawName);
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
                for (const addr of subProductKeys) {
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
            for (const addr of actorKeys) {
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
        "fee | delay | both (submit only; ignored for revoke)",
        "both",
        types.string
    )
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .addOptionalParam(
        "controller",
        "ExitFeeController address (defaults to the deployment record or the protocol pointer)"
    )
    .setAction(
        async ({ action, surface, actor, half, dryRun, signer, multisig, controller }, hre) => {
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
                    ? policy.planExemption({ half, fee, bypass, build })
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
    .addFlag("dryRun", "Print the plan without submitting anything")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .addOptionalParam(
        "controller",
        "ExitFeeController address (defaults to the deployment record or the protocol pointer)"
    )
    .setAction(
        async (
            { surface, subproduct, actor, rate, dryRun, signer, multisig, controller },
            hre
        ) => {
            const { ethers: hreEthers } = hre;
            if (subproduct && actor) {
                throw new Error("perimeter:fee:set: pass --subproduct or --actor, not both");
            }

            const resolvedSurface = policy.resolveSurface(surface);
            const parsedRate = policy.parseRate(rate);
            const { address: controllerAddress, controller: controllerContract } =
                await attachController(hre, controller);

            let kind;
            let tier;
            let address;
            if (subproduct) {
                address = await requireSubProductTarget(
                    hre,
                    resolvedSurface,
                    subproduct,
                    "perimeter:fee:set"
                );
                kind = "setSubProductPolicy";
                tier = "sub-product";
            } else if (actor) {
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
            if (Boolean(subproduct) === Boolean(actor)) {
                throw new Error(
                    "perimeter:fee:remove: pass exactly one of --subproduct or --actor"
                );
            }

            const resolvedSurface = policy.resolveSurface(surface);
            const { address: controllerAddress, controller: controllerContract } =
                await attachController(hre, controller);

            let tier;
            let kind;
            let address;
            if (subproduct) {
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
    "Print a submitted controller-policy transaction and decode which call it makes"
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
        const { address: controllerAddress } = await attachController(hre, controller);

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

        const decoded = policy.decodeCall(tx.data);
        logger.info(
            decoded
                ? `Call:     ${decoded.signature} — ${decoded.meaning}`
                : "Call:     NOT a controller policy call"
        );

        await multisigCheckTx(id, multisigAddress);
    });
