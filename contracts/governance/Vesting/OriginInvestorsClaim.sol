pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./VestingRegistry.sol";
import "../Staking/Staking.sol";

/**
 * @title Origin investors claim vested cSOV tokens
 * @notice // TODO: fund this contract with a total amount of SOV needed to distribute
 *
 */
contract OriginInvestorsClaim is Ownable {
	using SafeMath for uint256;

	//VestingRegistry public constant vestingRegistry = VestingRegistry(0x80B036ae59B3e38B573837c01BB1DB95515b7E6B);

	uint256 totalAmount;

	///@notice constant used for computing the vesting dates
	uint256 public constant SOV_VESTING_CLIFF = 6 weeks;

	uint256 public kickoffTS;
	uint256 public vestingTerm;
	uint256 public investorsQty;
	bool public investorsListInitialized;
	VestingRegistry public vestingRegistry;
	Staking public staking;
	IERC20 public SOVToken;

	//user => flag whether user has admin role
	mapping(address => bool) public admins;

	// origin investors entitled to claim SOV
	mapping(address => uint256) public investorsAmountsList;

	event AdminAdded(address admin);
	event AdminRemoved(address admin);
	event InvestorsAmountsListSet(uint256 qty, uint256 totalAmount);
	event ClaimVested(address indexed investor, address indexed receiver, uint256 amount);
	event ClaimTransferred(address indexed investor, uint256 amount);
	event InvestorsAmountsListInitialized(uint256 qty, uint256 totalAmount);

	/**
	 * @dev Throws if called by any account other than the owner or admin.
	 */
	modifier onlyAuthorized() {
		require(isOwner() || admins[msg.sender], "OriginInvestorsClaim::onlyAuthorized: unauthorized");
		_;
	}

	modifier onlyWhitelisted() {
		require(investorsAmountsList[msg.sender] != 0, "OriginInvestorsClaim::onlyWhitelisted: not whitelisted or already claimed");
		_;
	}

	modifier notInitialized() {
		require(!investorsListInitialized, "OriginInvestorsClaim::setInvestorsAmountsList: the investors list has already been set");
		_;
	}

	modifier initialized() {
		require(investorsListInitialized, "OriginInvestorsClaim::setInvestorsAmountsList: the investors list has not been set yet");
		_;
	}

	constructor(address vestingRegistryAddress) public {
		vestingRegistry = VestingRegistry(vestingRegistryAddress);
		staking = Staking(vestingRegistry.staking());
		kickoffTS = staking.kickoffTS();
		SOVToken = staking.SOVToken();
		vestingTerm = kickoffTS + SOV_VESTING_CLIFF;
	}

	function addAdmin(address _admin) public onlyOwner {
		admins[_admin] = true;
		emit AdminAdded(_admin);
	}

	function removeAdmin(address _admin) public onlyOwner {
		admins[_admin] = false;
		emit AdminRemoved(_admin);
	}

	/**
	 * @notice in case we have unclaimed tokens or in emergency case
	 */
	function authorizedBalanceWithdraw(address toAddress) public onlyAuthorized {
		require(
			SOVToken.transfer(toAddress, SOVToken.balanceOf(address(this))),
			"OriginInvestorsClaim::authorizedTransferBalance: transfer failed"
		);
	}

	/**
	 * @notice should ne called after the investors list setup completed
	 */
	function setInvestorsAmountsListIntilized() public onlyAuthorized notInitialized {
		require(
			SOVToken.balanceOf(address(this)) >= totalAmount,
			"OriginInvestorsClaim::setInvestorsAmountsList: the contract is not enough financed"
		);

		investorsListInitialized = true;

		emit InvestorsAmountsListInitialized(investorsQty, totalAmount);
	}

	/**
	 *  @notice the contract should be approved or transferred necessary amount of SOV prior to calling the function
	 *  @param investors is the list of investors addresses
	 *  @param claimAmounts is the list of amounts for investors investors[i] will receive claimAmounts[i] of SOV
	 */
	function setInvestorsAmountsList(address[] calldata investors, uint256[] calldata claimAmounts) external onlyAuthorized notInitialized {
		require(
			investors.length == claimAmounts.length,
			"OriginInvestorsClaim::setInvestorsAmountsList: investors.length != claimAmounts.length"
		);

		for (uint256 i = 0; i < investors.length; i++) {
			investorsAmountsList[investors[i]] = claimAmounts[i];
			totalAmount = totalAmount.add(claimAmounts[i]);
		}

		investorsQty = investorsQty.add(investors.length);
		emit InvestorsAmountsListSet(investors.length, totalAmount);
	}

	function claim(address receiver) external onlyWhitelisted initialized {
		if (now < vestingTerm) {
			createVesting(receiver);
		} else {
			transfer();
		}
	}

	function createVesting(address receiver) internal {
		uint256 cliff = vestingTerm.sub(now);
		uint256 duration = cliff;
		uint256 amount = investorsAmountsList[msg.sender];
		address vestingContractAddress;

		vestingContractAddress = vestingRegistry.getVesting(receiver);
		require(vestingContractAddress == address(0), "OriginInvestorsClaim::withdraw: the receiver has an active vesting contract");

		delete investorsAmountsList[msg.sender];

		vestingRegistry.createVesting(receiver, amount, cliff, duration);
		vestingContractAddress = vestingRegistry.getVesting(receiver);
		require(SOVToken.transfer(address(vestingRegistry), amount), "OriginInvestorsClaim::withdraw: SOV transfer failed");
		vestingRegistry.stakeTokens(vestingContractAddress, amount);

		emit ClaimVested(msg.sender, receiver, amount);
	}

	function transfer() internal {
		uint256 amount = investorsAmountsList[msg.sender];

		delete investorsAmountsList[msg.sender];

		// withdraw only for those claiming after the cliff, i.e. without vesting contracts
		// those with vestingContracts should withdraw using Vesting.withdrawTokens
		// from Vesting (VestingLogic) contract
		require(SOVToken.transfer(msg.sender, amount), "OriginInvestorsClaim::withdraw: SOV transfer failed");

		emit ClaimTransferred(msg.sender, amount);
	}
}
