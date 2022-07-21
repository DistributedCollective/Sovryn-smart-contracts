pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../CheckpointsShared.sol";
import "../../../openzeppelin/Address.sol";
import "../StakingShared.sol";
import "../../../proxy/modules/interfaces/IFunctionsList.sol";
import "../../../rsk/RSKAddrValidator.sol";
import "../../Vesting/IVesting.sol";

/**
 * @title Weighted Staking contract.
 * @notice Computation of power and votes used by FeeSharingProxy and
 * GovernorAlpha and Staking contracts w/ mainly 3 public functions:
 *   + getPriorTotalVotingPower => Total voting power.
 *   + getPriorVotes  => Delegatee voting power.
 *   + getPriorWeightedStake  => User Weighted Stake.
 * Staking contract inherits WeightedStaking.
 * FeeSharingProxy and GovernorAlpha invoke Staking instance functions.
 * */
contract StakingGovernanceModule is IFunctionsList, StakingShared, CheckpointsShared {
    using Address for address payable;

    /************* TOTAL VOTING POWER COMPUTATION ************************/

    /**
     * @notice Compute the total voting power at a given time.
     * @param blockNumber The block number, needed for checkpointing.
     * @param time The timestamp for which to calculate the total voting power.
     * @return The total voting power at the given time.
     * */
    function getPriorTotalVotingPower(uint32 blockNumber, uint256 time)
        public
        view
        returns (uint96 totalVotingPower)
    {
        /// @dev Start the computation with the exact or previous unlocking date (voting weight remians the same until the next break point).
        uint256 start = _timestampToLockDate(time);
        uint256 end = start + MAX_DURATION;

        /// @dev Max 78 iterations.
        for (uint256 i = start; i <= end; i += TWO_WEEKS) {
            totalVotingPower = add96(
                totalVotingPower,
                _totalPowerByDate(i, start, blockNumber),
                "WS06"
            ); // arrays mismatch
        }
    }

    /**
     * @notice Compute the voting power for a specific date.
     * Power = stake * weight
     * @param date The staking date to compute the power for.
     * @param startDate The date for which we need to know the power of the stake.
     * @param blockNumber The block number, needed for checkpointing.
     * @return The stacking power.
     * */
    function _totalPowerByDate(
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) internal view returns (uint96 power) {
        uint96 weight = _computeWeightByDate(date, startDate);
        uint96 staked = getPriorTotalStakesForDate(date, blockNumber);
        /// @dev weight is multiplied by some factor to allow decimals.
        power = mul96(staked, weight, "WS07") / WEIGHT_FACTOR; // mul overflow
    }

    /****************************** DELEGATED VOTING POWER COMPUTATION ************************/

    /**
     * @notice Get the current votes balance for a user account.
     * @param account The address to get votes balance.
     * @dev This is a wrapper to simplify arguments. The actual computation is
     * performed on WeightedStaking parent contract.
     * @return The number of current votes for a user account.
     * */
    function getCurrentVotes(address account) external view returns (uint96) {
        return getPriorVotes(account, block.number - 1, block.timestamp);
    }

    /**
     * @notice Determine the prior number of votes for a delegatee as of a block number.
     * Iterate through checkpoints adding up voting power.
     * @dev Block number must be a finalized block or else this function will revert
     * to prevent misinformation.
     *      Used for Voting, not for fee sharing.
     * @param account The address of the account to check.
     * @param blockNumber The block number to get the vote balance at.
     * @param date The staking date to compute the power for.
     * @return The number of votes the delegatee had as of the given block.
     * */
    function getPriorVotes(
        address account,
        uint256 blockNumber,
        uint256 date
    ) public view returns (uint96 votes) {
        /// @dev If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).
        uint256 start = _timestampToLockDate(date);
        uint256 end = start + MAX_DURATION;

        /// @dev Max 78 iterations.
        for (uint256 i = start; i <= end; i += TWO_WEEKS) {
            votes = add96(
                votes,
                _totalPowerByDateForDelegatee(account, i, start, blockNumber),
                "WS09"
            ); // overflow - total VP
        }
    }

    /**
     * @notice Compute the voting power for a specific date.
     * Power = stake * weight
     * @param account The address of the account to check.
     * @param date The staking date to compute the power for.
     * @param startDate The date for which we need to know the power of the stake.
     * @param blockNumber The block number, needed for checkpointing.
     * @return The stacking power.
     * */
    function _totalPowerByDateForDelegatee(
        address account,
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) internal view returns (uint96 power) {
        uint96 weight = _computeWeightByDate(date, startDate);
        uint96 staked = getPriorStakeByDateForDelegatee(account, date, blockNumber);
        power = mul96(staked, weight, "WS10") / WEIGHT_FACTOR; // overflow
    }

    /**
     * @notice Determine the prior number of stake for an account as of a block number.
     * @dev Block number must be a finalized block or else this function will
     * revert to prevent misinformation.
     * @param account The address of the account to check.
     * @param date The staking date to compute the power for.
     * @param blockNumber The block number to get the vote balance at.
     * @return The number of votes the account had as of the given block.
     * */
    function getPriorStakeByDateForDelegatee(
        address account,
        uint256 date,
        uint256 blockNumber
    ) public view returns (uint96) {
        require(blockNumber < _getCurrentBlockNumber(), "WS11"); // not determined yet

        uint32 nCheckpoints = numDelegateStakingCheckpoints[account][date];
        if (nCheckpoints == 0) {
            return 0;
        }

        /// @dev First check most recent balance.
        if (delegateStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return delegateStakingCheckpoints[account][date][nCheckpoints - 1].stake;
        }

        /// @dev Next check implicit zero balance.
        if (delegateStakingCheckpoints[account][date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; /// @dev ceil, avoiding overflow.
            Checkpoint memory cp = delegateStakingCheckpoints[account][date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return delegateStakingCheckpoints[account][date][lower].stake;
    }

    /**************** SHARED FUNCTIONS *********************/

    /**
     * @notice Determine the prior number of stake for an unlocking date as of a block number.
     * @dev Block number must be a finalized block or else this function will
     * revert to prevent misinformation.
     * TODO: WeightedStaking::getPriorTotalStakesForDate should probably better
     * be internal instead of a public function.
     * @param date The date to check the stakes for.
     * @param blockNumber The block number to get the vote balance at.
     * @return The number of votes the account had as of the given block.
     * */
    function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber)
        public
        view
        returns (uint96)
    {
        require(blockNumber < _getCurrentBlockNumber(), "WS08"); // not determined

        uint32 nCheckpoints = numTotalStakingCheckpoints[date];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (totalStakingCheckpoints[date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return totalStakingCheckpoints[date][nCheckpoints - 1].stake;
        }

        // Next check implicit zero balance
        if (totalStakingCheckpoints[date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = totalStakingCheckpoints[date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return totalStakingCheckpoints[date][lower].stake;
    }

    /**
     * @notice Set new delegatee. Move from user's current delegate to a new
     * delegatee the stake balance.
     * @param delegator The user address to move stake balance from its current delegatee.
     * @param delegatee The new delegatee. The address to move stake balance to.
     * @param lockedTS The lock date.
     * */
    function _delegate(
        address delegator,
        address delegatee,
        uint256 lockedTS
    ) internal {
        address currentDelegate = delegates[delegator][lockedTS];
        uint96 delegatorBalance = _currentBalance(delegator, lockedTS);
        delegates[delegator][lockedTS] = delegatee;

        emit DelegateChanged(delegator, lockedTS, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance, lockedTS);
    }

    // @dev delegates tokens for lock date 2 weeks later than given lock date
    //		if message sender is a contract
    function _delegateNext(
        address delegator,
        address delegatee,
        uint256 lockedTS
    ) internal {
        if (_isVestingContract(msg.sender)) {
            uint256 nextLock = lockedTS.add(TWO_WEEKS);
            address currentDelegate = delegates[delegator][nextLock];
            if (currentDelegate != delegatee) {
                _delegate(delegator, delegatee, nextLock);
            }

            // @dev workaround for the issue with a delegation of the latest stake
            uint256 endDate = IVesting(msg.sender).endDate();
            nextLock = lockedTS.add(FOUR_WEEKS);
            if (nextLock == endDate) {
                currentDelegate = delegates[delegator][nextLock];
                if (currentDelegate != delegatee) {
                    _delegate(delegator, delegatee, nextLock);
                }
            }
        }
    }

    /**
     * @notice Move an amount of delegate stake from a source address to a
     * destination address.
     * @param srcRep The address to get the staked amount from.
     * @param dstRep The address to send the staked amount to.
     * @param amount The staked amount to move.
     * @param lockedTS The lock date.
     * */
    function _moveDelegates(
        address srcRep,
        address dstRep,
        uint96 amount,
        uint256 lockedTS
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) _decreaseDelegateStake(srcRep, lockedTS, amount);

            if (dstRep != address(0)) _increaseDelegateStake(dstRep, lockedTS, amount);
        }
    }

    /**
     * @notice Retrieve CHAIN_ID of the executing chain.
     *
     * Chain identifier (chainID) introduced in EIP-155 protects transaction
     * included into one chain from being included into another chain.
     * Basically, chain identifier is an integer number being used in the
     * processes of signing transactions and verifying transaction signatures.
     *
     * @dev As of version 0.5.12, Solidity includes an assembly function
     * chainid() that provides access to the new CHAINID opcode.
     *
     * TODO: chainId is included in block. So you can get chain id like
     * block timestamp or block number: block.chainid;
     * */
    function _getChainId() internal pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }

    /**
     * @notice Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`.
     * @param delegatee The address to delegate votes to.
     * @param lockDate the date if the position to delegate.
     * */
    function delegate(address delegatee, uint256 lockDate) external whenNotPaused {
        _notSameBlockAsStakingCheckpoint(lockDate);

        _delegate(msg.sender, delegatee, lockDate);
        // @dev delegates tokens for lock date 2 weeks later than given lock date
        //		if message sender is a contract
        _delegateNext(msg.sender, delegatee, lockDate);
    }

    /**
     * @notice Delegates votes from signatory to a delegatee account.
     * Voting with EIP-712 Signatures.
     *
     * Voting power can be delegated to any address, and then can be used to
     * vote on proposals. A key benefit to users of by-signature functionality
     * is that they can create a signed vote transaction for free, and have a
     * trusted third-party spend rBTC(or ETH) on gas fees and write it to the
     * blockchain for them.
     *
     * The third party in this scenario, submitting the SOV-holder’s signed
     * transaction holds a voting power that is for only a single proposal.
     * The signatory still holds the power to vote on their own behalf in
     * the proposal if the third party has not yet published the signed
     * transaction that was given to them.
     *
     * @dev The signature needs to be broken up into 3 parameters, known as
     * v, r and s:
     * const r = '0x' + sig.substring(2).substring(0, 64);
     * const s = '0x' + sig.substring(2).substring(64, 128);
     * const v = '0x' + sig.substring(2).substring(128, 130);
     *
     * @param delegatee The address to delegate votes to.
     * @param lockDate The date until which the position is locked.
     * @param nonce The contract state required to match the signature.
     * @param expiry The time at which to expire the signature.
     * @param v The recovery byte of the signature.
     * @param r Half of the ECDSA signature pair.
     * @param s Half of the ECDSA signature pair.
     * */
    function delegateBySig(
        address delegatee,
        uint256 lockDate,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused {
        _notSameBlockAsStakingCheckpoint(lockDate);

        /**
         * @dev The DOMAIN_SEPARATOR is a hash that uniquely identifies a
         * smart contract. It is built from a string denoting it as an
         * EIP712 Domain, the name of the token contract, the version,
         * the chainId in case it changes, and the address that the
         * contract is deployed at.
         * */
        bytes32 domainSeparator =
            keccak256(
                abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), _getChainId(), address(this))
            );

        /// @dev GovernorAlpha uses BALLOT_TYPEHASH, while Staking uses DELEGATION_TYPEHASH
        bytes32 structHash =
            keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, lockDate, nonce, expiry));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);

        /// @dev Verify address is not null and PK is not null either.
        require(RSKAddrValidator.checkPKNotZero(signatory), "S13"); // Staking::delegateBySig: invalid signature
        require(nonce == nonces[signatory]++, "S14"); // Staking::delegateBySig: invalid nonce
        require(now <= expiry, "S15"); // Staking::delegateBySig: signature expired
        _delegate(signatory, delegatee, lockDate);
        // @dev delegates tokens for lock date 2 weeks later than given lock date
        //		if message sender is a contract
        _delegateNext(signatory, delegatee, lockDate);
    }

    function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionsList = new bytes4[](7);
        functionsList[0] = this.getPriorTotalVotingPower.selector;
        functionsList[1] = this.getCurrentVotes.selector;
        functionsList[2] = this.getPriorVotes.selector;
        functionsList[3] = this.getPriorStakeByDateForDelegatee.selector;
        functionsList[4] = this.getPriorTotalStakesForDate.selector;
        functionsList[5] = this.delegate.selector;
        functionsList[6] = this.delegateBySig.selector;
        return functionsList;
    }
}
