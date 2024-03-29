pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./VestingRegistry.sol";
import "../Staking/interfaces/IStaking.sol";

/**
 * @title Origin investors claim vested cSOV tokens.
 * @notice // TODO: fund this contract with a total amount of SOV needed to distribute.
 * */
contract OriginInvestorsClaim is Ownable {
    using SafeMath for uint256;

    /* Storage */

    /// VestingRegistry public constant vestingRegistry = VestingRegistry(0x80B036ae59B3e38B573837c01BB1DB95515b7E6B);

    uint256 public totalAmount;

    /// @notice Constant used for computing the vesting dates.
    uint256 public constant SOV_VESTING_CLIFF = 6 weeks;

    uint256 public kickoffTS;
    uint256 public vestingTerm;
    uint256 public investorsQty;
    bool public investorsListInitialized;
    VestingRegistry public vestingRegistry;
    IStaking public staking;
    IERC20 public SOVToken;

    /// @dev user => flag : Whether user has admin role.
    mapping(address => bool) public admins;

    /// @dev investor => Amount : Origin investors entitled to claim SOV.
    mapping(address => uint256) public investorsAmountsList;

    /* Events */

    event AdminAdded(address admin);
    event AdminRemoved(address admin);
    event InvestorsAmountsListAppended(uint256 qty, uint256 amount);
    event ClaimVested(address indexed investor, uint256 amount);
    event ClaimTransferred(address indexed investor, uint256 amount);
    event InvestorsAmountsListInitialized(uint256 qty, uint256 totalAmount);

    /* Modifiers */

    /// @dev Throws if called by any account other than the owner or admin.
    modifier onlyAuthorized() {
        require(
            isOwner() || admins[msg.sender],
            "OriginInvestorsClaim::onlyAuthorized: should be authorized"
        );
        _;
    }

    /// @dev Throws if called by any account not whitelisted.
    modifier onlyWhitelisted() {
        require(
            investorsAmountsList[msg.sender] != 0,
            "OriginInvestorsClaim::onlyWhitelisted: not whitelisted or already claimed"
        );
        _;
    }

    /// @dev Throws if called w/ an initialized investors list.
    modifier notInitialized() {
        require(
            !investorsListInitialized,
            "OriginInvestorsClaim::notInitialized: the investors list should not be set as initialized"
        );
        _;
    }

    /// @dev Throws if called w/ an uninitialized investors list.
    modifier initialized() {
        require(
            investorsListInitialized,
            "OriginInvestorsClaim::initialized: the investors list has not been set yet"
        );
        _;
    }

    /* Functions */

    /**
     * @notice Contract deployment requires one parameter:
     * @param vestingRegistryAddress The vestingRegistry contract instance address.
     * */
    constructor(address vestingRegistryAddress) public {
        vestingRegistry = VestingRegistry(vestingRegistryAddress);
        staking = IStaking(vestingRegistry.staking());
        kickoffTS = staking.kickoffTS();
        SOVToken = IERC20(staking.SOVToken());
        vestingTerm = kickoffTS + SOV_VESTING_CLIFF;
    }

    /**
     * @notice Add account to ACL.
     * @param _admin The addresses of the account to grant permissions.
     * */
    function addAdmin(address _admin) public onlyOwner {
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    /**
     * @notice Remove account from ACL.
     * @param _admin The addresses of the account to revoke permissions.
     * */
    function removeAdmin(address _admin) public onlyOwner {
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    /**
     * @notice In case we have unclaimed tokens or in emergency case
     * this function transfers all SOV tokens to a given address.
     * @param toAddress The recipient address of all this contract tokens.
     * */
    function authorizedBalanceWithdraw(address toAddress) public onlyAuthorized {
        require(
            SOVToken.transfer(toAddress, SOVToken.balanceOf(address(this))),
            "OriginInvestorsClaim::authorizedTransferBalance: transfer failed"
        );
    }

    /**
     * @notice Should be called after the investors list setup completed.
     * This function checks whether the SOV token balance of the contract is
     * enough and sets status list to initialized.
     * */
    function setInvestorsAmountsListInitialized() public onlyAuthorized notInitialized {
        require(
            SOVToken.balanceOf(address(this)) >= totalAmount,
            "OriginInvestorsClaim::setInvestorsAmountsList: the contract is not enough financed"
        );

        investorsListInitialized = true;

        emit InvestorsAmountsListInitialized(investorsQty, totalAmount);
    }

    /**
     * @notice The contract should be approved or transferred necessary
     * amount of SOV prior to calling the function.
     * @param investors The list of investors addresses to add to the list.
     * Duplicates will be skipped.
     * @param claimAmounts The list of amounts for investors investors[i]
     * will receive claimAmounts[i] of SOV.
     * */
    function appendInvestorsAmountsList(
        address[] calldata investors,
        uint256[] calldata claimAmounts
    ) external onlyAuthorized notInitialized {
        uint256 subQty;
        uint256 sumAmount;
        require(
            investors.length == claimAmounts.length,
            "OriginInvestorsClaim::appendInvestorsAmountsList: investors.length != claimAmounts.length"
        );

        for (uint256 i = 0; i < investors.length; i++) {
            if (investorsAmountsList[investors[i]] == 0) {
                investorsAmountsList[investors[i]] = claimAmounts[i];
                sumAmount = sumAmount.add(claimAmounts[i]);
            } else {
                subQty = subQty.add(1);
            }
        }

        investorsQty = investorsQty.add(investors.length.sub(subQty));
        totalAmount = totalAmount.add(sumAmount);
        emit InvestorsAmountsListAppended(investors.length.sub(subQty), sumAmount);
    }

    /**
     * @notice Claim tokens from this contract.
     * If vestingTerm is not yet achieved a vesting is created.
     * Otherwise tokens are tranferred.
     * */
    function claim() external onlyWhitelisted initialized {
        if (now < vestingTerm) {
            createVesting();
        } else {
            transfer();
        }
    }

    /**
     * @notice Transfer tokens from this contract to a vestingRegistry contract.
     * Sender is removed from investor list and all its unvested tokens
     * are sent to vesting contract.
     * */
    function createVesting() internal {
        uint256 cliff = vestingTerm.sub(now);
        uint256 duration = cliff;
        uint256 amount = investorsAmountsList[msg.sender];
        address vestingContractAddress;

        vestingContractAddress = vestingRegistry.getVesting(msg.sender);
        require(
            vestingContractAddress == address(0),
            "OriginInvestorsClaim::withdraw: the claimer has an active vesting contract"
        );

        delete investorsAmountsList[msg.sender];

        vestingRegistry.createVesting(msg.sender, amount, cliff, duration);
        vestingContractAddress = vestingRegistry.getVesting(msg.sender);
        require(
            SOVToken.transfer(address(vestingRegistry), amount),
            "OriginInvestorsClaim::withdraw: SOV transfer failed"
        );
        vestingRegistry.stakeTokens(vestingContractAddress, amount);

        emit ClaimVested(msg.sender, amount);
    }

    /**
     * @notice Transfer tokens from this contract to the sender.
     * Sender is removed from investor list and all its unvested tokens
     * are sent to its account.
     * */
    function transfer() internal {
        uint256 amount = investorsAmountsList[msg.sender];

        delete investorsAmountsList[msg.sender];

        /**
         * @dev Withdraw only for those claiming after the cliff, i.e. without vesting contracts.
         * Those with vestingContracts should withdraw using Vesting.withdrawTokens
         * from Vesting (VestingLogic) contract.
         * */
        require(
            SOVToken.transfer(msg.sender, amount),
            "OriginInvestorsClaim::withdraw: SOV transfer failed"
        );

        emit ClaimTransferred(msg.sender, amount);
    }
}
