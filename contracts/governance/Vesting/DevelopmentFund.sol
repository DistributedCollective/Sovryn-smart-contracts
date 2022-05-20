pragma solidity ^0.5.17;

import "../../openzeppelin/SafeMath.sol";
import "../../interfaces/IERC20.sol";

/**
 *  @title A holding contract for Sovryn Development Fund.
 *  @author Franklin Richards
 *  @notice You can use this contract for timed token release from Dev Fund.
 */
contract DevelopmentFund {
    using SafeMath for uint256;

    /* Storage */

    /// @notice The SOV token contract.
    IERC20 public SOV;

    /// @notice The current contract status.
    enum Status { Deployed, Active, Expired }
    Status public status;

    /// @notice The owner of the locked tokens (usually Governance).
    address public lockedTokenOwner;
    /// @notice The owner of the unlocked tokens (usually MultiSig).
    address public unlockedTokenOwner;
    /// @notice The emergency transfer wallet/contract.
    address public safeVault;
    /// @notice The new locked token owner waiting to be approved.
    address public newLockedTokenOwner;

    /// @notice The last token release timestamp or the time of contract creation.
    uint256 public lastReleaseTime;

    /// @notice The release duration array in seconds.
    uint256[] public releaseDuration;
    /// @notice The release token amount.
    uint256[] public releaseTokenAmount;

    /* Events */

    /// @notice Emitted when the contract is activated.
    event DevelopmentFundActivated();

    /// @notice Emitted when the contract is expired due to total token transfer.
    event DevelopmentFundExpired();

    /// @notice Emitted when a new locked owner is added to the contract.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _newLockedOwner The address which is added as the new locked owner.
    /// @dev Can only be initiated by the current locked owner.
    event NewLockedOwnerAdded(address indexed _initiator, address indexed _newLockedOwner);

    /// @notice Emitted when a new locked owner is approved to the contract.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _oldLockedOwner The address of the previous locked owner.
    /// @param _newLockedOwner The address which is added as the new locked owner.
    /// @dev Can only be initiated by the current unlocked owner.
    event NewLockedOwnerApproved(
        address indexed _initiator,
        address indexed _oldLockedOwner,
        address indexed _newLockedOwner
    );

    /// @notice Emitted when a new unlocked owner is updated in the contract.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _newUnlockedOwner The address which is updated as the new unlocked owner.
    /// @dev Can only be initiated by the current locked owner.
    event UnlockedOwnerUpdated(address indexed _initiator, address indexed _newUnlockedOwner);

    /// @notice Emitted when a new token deposit is done.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _amount The total amount of token deposited.
    event TokenDeposit(address indexed _initiator, uint256 _amount);

    /// @notice Emitted when a new release schedule is created.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _releaseCount The number of releases planned in the schedule.
    event TokenReleaseChanged(address indexed _initiator, uint256 _releaseCount);

    /// @notice Emitted when a unlocked owner transfers all the tokens to a safe vault.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _receiver The address which receives this token withdrawn.
    /// @param _amount The total amount of token transferred.
    /// @dev This is done in an emergency situation only to a predetermined wallet by locked token owner.
    event LockedTokenTransferByUnlockedOwner(
        address indexed _initiator,
        address indexed _receiver,
        uint256 _amount
    );

    /// @notice Emitted when a unlocked owner withdraws the released tokens.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _amount The total amount of token withdrawn.
    /// @param _releaseCount The total number of releases done based on duration.
    event UnlockedTokenWithdrawalByUnlockedOwner(
        address indexed _initiator,
        uint256 _amount,
        uint256 _releaseCount
    );

    /// @notice Emitted when a locked owner transfers all the tokens to a receiver.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _receiver The address which receives this token transfer.
    /// @param _amount The total amount of token transferred.
    /// @dev This is done only by locked token owner.
    event LockedTokenTransferByLockedOwner(
        address indexed _initiator,
        address indexed _receiver,
        uint256 _amount
    );

    /* Modifiers */

    modifier onlyLockedTokenOwner() {
        require(msg.sender == lockedTokenOwner, "Only Locked Token Owner can call this.");
        _;
    }

    modifier onlyUnlockedTokenOwner() {
        require(msg.sender == unlockedTokenOwner, "Only Unlocked Token Owner can call this.");
        _;
    }

    modifier checkStatus(Status s) {
        require(status == s, "The contract is not in the right state.");
        _;
    }

    /* Functions */

    /**
     * @notice Setup the required parameters.
     * @param _SOV The SOV token address.
     * @param _lockedTokenOwner The owner of the locked tokens & contract.
     * @param _safeVault The emergency wallet/contract to transfer token.
     * @param _unlockedTokenOwner The owner of the unlocked tokens.
     * @param _lastReleaseTime If the last release time is to be changed, zero if no change required.
     * @param _releaseDuration The time duration between each release calculated from `lastReleaseTime` in seconds.
     * @param _releaseTokenAmount The amount of token to be released in each duration/interval.
     * @dev Initial release schedule should be verified, error will result in either redeployment or calling changeTokenReleaseSchedule() after init() along with token transfer.
     */
    constructor(
        address _SOV,
        address _lockedTokenOwner,
        address _safeVault,
        address _unlockedTokenOwner,
        uint256 _lastReleaseTime,
        uint256[] memory _releaseDuration,
        uint256[] memory _releaseTokenAmount
    ) public {
        require(_SOV != address(0), "Invalid SOV Address.");
        require(_lockedTokenOwner != address(0), "Locked token & contract owner address invalid.");
        require(_safeVault != address(0), "Safe Vault address invalid.");
        require(_unlockedTokenOwner != address(0), "Unlocked token address invalid.");

        SOV = IERC20(_SOV);
        lockedTokenOwner = _lockedTokenOwner;
        safeVault = _safeVault;
        unlockedTokenOwner = _unlockedTokenOwner;

        lastReleaseTime = _lastReleaseTime;
        /// If last release time passed is zero, then current time stamp will be used as the last release time.
        if (_lastReleaseTime == 0) {
            lastReleaseTime = block.timestamp;
        }

        /// Checking if the schedule duration and token allocation length matches.
        require(
            _releaseDuration.length == _releaseTokenAmount.length,
            "Release Schedule does not match."
        );

        /// Finally we update the token release schedule.
        releaseDuration = _releaseDuration;
        releaseTokenAmount = _releaseTokenAmount;
    }

    /**
     * @notice This function is called once after deployment for token transfer based on schedule.
     * @dev Without calling this function, the contract will not work.
     */
    function init() public checkStatus(Status.Deployed) {
        uint256[] memory _releaseTokenAmount = releaseTokenAmount;
        require(_releaseTokenAmount.length != 0, "Release Schedule not set.");

        /// Getting the current release schedule total token amount.
        uint256 _releaseTotalTokenAmount;
        for (uint256 amountIndex = 0; amountIndex < _releaseTokenAmount.length; amountIndex++) {
            _releaseTotalTokenAmount = _releaseTotalTokenAmount.add(
                _releaseTokenAmount[amountIndex]
            );
        }

        bool txStatus = SOV.transferFrom(msg.sender, address(this), _releaseTotalTokenAmount);
        require(txStatus, "Not enough token sent to change release schedule.");

        status = Status.Active;

        emit DevelopmentFundActivated();
    }

    /**
     * @notice Update Locked Token Owner.
     * @param _newLockedTokenOwner The owner of the locked tokens & contract.
     */
    function updateLockedTokenOwner(address _newLockedTokenOwner)
        public
        onlyLockedTokenOwner
        checkStatus(Status.Active)
    {
        require(_newLockedTokenOwner != address(0), "New locked token owner address invalid.");

        newLockedTokenOwner = _newLockedTokenOwner;

        emit NewLockedOwnerAdded(msg.sender, _newLockedTokenOwner);
    }

    /**
     * @notice Approve Locked Token Owner.
     * @dev This approval is an added security to avoid development fund takeover by a compromised locked token owner.
     */
    function approveLockedTokenOwner() public onlyUnlockedTokenOwner checkStatus(Status.Active) {
        require(newLockedTokenOwner != address(0), "No new locked owner added.");

        emit NewLockedOwnerApproved(msg.sender, lockedTokenOwner, newLockedTokenOwner);

        lockedTokenOwner = newLockedTokenOwner;

        newLockedTokenOwner = address(0);
    }

    /**
     * @notice Update Unlocked Token Owner.
     * @param _newUnlockedTokenOwner The new unlocked token owner.
     */
    function updateUnlockedTokenOwner(address _newUnlockedTokenOwner)
        public
        onlyLockedTokenOwner
        checkStatus(Status.Active)
    {
        require(_newUnlockedTokenOwner != address(0), "New unlocked token owner address invalid.");

        unlockedTokenOwner = _newUnlockedTokenOwner;

        emit UnlockedOwnerUpdated(msg.sender, _newUnlockedTokenOwner);
    }

    /**
     * @notice Deposit tokens to this contract.
     * @param _amount the amount of tokens deposited.
     * @dev These tokens can be withdrawn/transferred any time by the lockedTokenOwner.
     */
    function depositTokens(uint256 _amount) public checkStatus(Status.Active) {
        require(_amount > 0, "Amount needs to be bigger than zero.");

        bool txStatus = SOV.transferFrom(msg.sender, address(this), _amount);
        require(txStatus, "Token transfer was not successful.");

        emit TokenDeposit(msg.sender, _amount);
    }

    /**
     * @notice Change the Token release schedule. It creates a completely new schedule, and does not append on the previous one.
     * @param _newLastReleaseTime If the last release time is to be changed, zero if no change required.
     * @param _releaseDuration The time duration between each release calculated from `lastReleaseTime` in seconds.
     * @param _releaseTokenAmount The amount of token to be released in each duration/interval.
     * @dev _releaseDuration and _releaseTokenAmount should be specified in reverse order of release.
     */
    function changeTokenReleaseSchedule(
        uint256 _newLastReleaseTime,
        uint256[] memory _releaseDuration,
        uint256[] memory _releaseTokenAmount
    ) public onlyLockedTokenOwner checkStatus(Status.Active) {
        /// Checking if the schedule duration and token allocation length matches.
        require(
            _releaseDuration.length == _releaseTokenAmount.length,
            "Release Schedule does not match."
        );

        /// If the last release time has to be changed, then you can pass a new one here.
        /// Or else, the duration of release will be calculated based on this timestamp.
        /// Even a future timestamp can be mentioned here.
        if (_newLastReleaseTime != 0) {
            lastReleaseTime = _newLastReleaseTime;
        }

        /// Checking if the contract have enough token balance for the release.
        uint256 _releaseTotalTokenAmount;
        for (uint256 amountIndex = 0; amountIndex < _releaseTokenAmount.length; amountIndex++) {
            _releaseTotalTokenAmount = _releaseTotalTokenAmount.add(
                _releaseTokenAmount[amountIndex]
            );
        }

        /// Getting the current token balance of the contract.
        uint256 remainingTokens = SOV.balanceOf(address(this));

        /// If the token balance is not sufficient, then we transfer the change to contract.
        if (remainingTokens < _releaseTotalTokenAmount) {
            bool txStatus =
                SOV.transferFrom(
                    msg.sender,
                    address(this),
                    _releaseTotalTokenAmount.sub(remainingTokens)
                );
            require(txStatus, "Not enough token sent to change release schedule.");
        } else if (remainingTokens > _releaseTotalTokenAmount) {
            /// If there are more tokens than required, send the extra tokens back.
            bool txStatus =
                SOV.transfer(msg.sender, remainingTokens.sub(_releaseTotalTokenAmount));
            require(txStatus, "Token not received by the Locked Owner.");
        }

        /// Finally we update the token release schedule.
        releaseDuration = _releaseDuration;
        releaseTokenAmount = _releaseTokenAmount;

        emit TokenReleaseChanged(msg.sender, _releaseDuration.length);
    }

    /**
     * @notice Transfers all of the remaining tokens in an emergency situation.
     * @dev This could be called when governance or development fund might be compromised.
     */
    function transferTokensByUnlockedTokenOwner()
        public
        onlyUnlockedTokenOwner
        checkStatus(Status.Active)
    {
        uint256 remainingTokens = SOV.balanceOf(address(this));
        bool txStatus = SOV.transfer(safeVault, remainingTokens);
        require(txStatus, "Token transfer was not successful. Check receiver address.");
        status = Status.Expired;

        emit LockedTokenTransferByUnlockedOwner(msg.sender, safeVault, remainingTokens);
        emit DevelopmentFundExpired();
    }

    /**
     * @notice Withdraws all unlocked/released token.
     * @param _amount The amount to be withdrawn.
     */
    function withdrawTokensByUnlockedTokenOwner(uint256 _amount)
        public
        onlyUnlockedTokenOwner
        checkStatus(Status.Active)
    {
        require(_amount > 0, "Zero can't be withdrawn.");

        uint256 count; /// To know how many elements to be removed from the release schedule.
        uint256 amount = _amount; /// To know the total amount to be transferred.
        uint256 newLastReleaseTimeMemory = lastReleaseTime; /// Better to use memory than storage.
        uint256 releaseLength = releaseDuration.length.sub(1); /// Also checks if there are any elements in the release schedule.

        /// Getting the amount of tokens, the number of releases and calculating the total duration.
        while (
            amount > 0 &&
            newLastReleaseTimeMemory.add(releaseDuration[releaseLength]) < block.timestamp
        ) {
            if (amount >= releaseTokenAmount[releaseLength]) {
                amount = amount.sub(releaseTokenAmount[releaseLength]);
                newLastReleaseTimeMemory = newLastReleaseTimeMemory.add(
                    releaseDuration[releaseLength]
                );
                count++;
            } else {
                /// This will be the last case, if correct amount is passed.
                releaseTokenAmount[releaseLength] = releaseTokenAmount[releaseLength].sub(amount);
                amount = 0;
            }
            releaseLength--;
        }

        /// Checking to see if atleast a single schedule was reached or not.
        require(count > 0 || amount == 0, "No release schedule reached.");

        /// If locked token owner tries to send a higher amount that schedule
        uint256 value = _amount.sub(amount);

        /// Now clearing up the release schedule.
        releaseDuration.length -= count;
        releaseTokenAmount.length -= count;

        /// Updating the last release time.
        lastReleaseTime = newLastReleaseTimeMemory;

        /// Sending the amount to unlocked token owner.
        bool txStatus = SOV.transfer(msg.sender, value);
        require(txStatus, "Token transfer was not successful. Check receiver address.");

        emit UnlockedTokenWithdrawalByUnlockedOwner(msg.sender, value, count);
    }

    /**
     * @notice Transfers all of the remaining tokens by the owner maybe for an upgrade.
     * @dev This could be called when the current development fund has to be upgraded.
     * @param _receiver The address which receives this token transfer.
     */
    function transferTokensByLockedTokenOwner(address _receiver)
        public
        onlyLockedTokenOwner
        checkStatus(Status.Active)
    {
        uint256 remainingTokens = SOV.balanceOf(address(this));
        bool txStatus = SOV.transfer(_receiver, remainingTokens);
        require(txStatus, "Token transfer was not successful. Check receiver address.");
        status = Status.Expired;

        emit LockedTokenTransferByLockedOwner(msg.sender, _receiver, remainingTokens);
        emit DevelopmentFundExpired();
    }

    /* Getter Functions */

    /**
     * @notice Function to read the current token release duration.
     * @return _currentReleaseDuration The current release duration.
     */
    function getReleaseDuration() public view returns (uint256[] memory _releaseTokenDuration) {
        return releaseDuration;
    }

    /**
     * @notice Function to read the current token release amount.
     * @return _currentReleaseTokenAmount The current release token amount.
     */
    function getReleaseTokenAmount()
        public
        view
        returns (uint256[] memory _currentReleaseTokenAmount)
    {
        return releaseTokenAmount;
    }
}
