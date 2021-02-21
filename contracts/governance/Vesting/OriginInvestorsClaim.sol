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

	///@notice constant used for computing the vesting dates
	uint256 public constant SOV_VESTING_CLIFF = 6 weeks;

	VestingRegistry public vestingRegistry;
	Staking public staking;
	uint256 public kickoffTS;
	IERC20 public SOVToken;
	uint256 public vestingTerm;
	bool public investorsListInitialized;

	//user => flag whether user has admin role
	mapping(address => bool) public admins;

	// origin investors entitled to claim SOV
	mapping(address => uint256) public investorsAmountsList;

	event AdminAdded(address admin);
	event AdminRemoved(address admin);
	event InvestorsAmountsListSet(uint256 qty, uint256 totalAmount);
	event ClaimVested(address indexed investor, uint256 amount);
	event ClaimTransferred(address indexed investor, uint256 amount);

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

	//in case we have unclaimed tokens
	function authorizedBalanceWithdraw(address toAddress) public onlyAuthorized {
		require(
			SOVToken.transfer(toAddress, SOVToken.balanceOf(address(this))),
			"OriginInvestorsClaim::authorizedTransferBalance: transfer failed"
		);
	}

	/**
	 *  @notice the contract should be approved or transferred necessary amount of SOV prior to calling the function
	 *	@param allowanceFrom address that approved total amount for this contract or 0x0 if transferred
	 *  @param investors is the list of investors addresses
	 *  @param claimAmounts is the list of amounts for investors investors[i] will receive claimAmounts[i] of SOV
	 */
	function setInvestorsAmountsList(
		address[] memory investors,
		uint256[] memory claimAmounts,
		address allowanceFrom
	) public onlyAuthorized {
		uint256 totalAmount;
		require(
			investors.length == claimAmounts.length,
			"OriginInvestorsClaim::setInvestorsAmountsList: investors.length != claimAmounts.length"
		);
		require(!investorsListInitialized, "OriginInvestorsClaim::setInvestorsAmountsList: the investors list has already been set");
		investorsListInitialized = true;

		for (uint256 i = 0; i < investors.length; i++) {
			investorsAmountsList[investors[i]] = claimAmounts[i];
			totalAmount = totalAmount.add(claimAmounts[i]);
		}

		require(
			SOVToken.balanceOf(address(this)) >= totalAmount ||
				(allowanceFrom != address(0) && SOVToken.transferFrom(allowanceFrom, address(this), totalAmount)),
			"OriginInvestorsClaim::setInvestorsAmountsList: the contract is not enough financed or wrong allowance address passed"
		);

		emit InvestorsAmountsListSet(investors.length, totalAmount);
	}

	function claim() public onlyWhitelisted {
		if (now < vestingTerm) {
			createVesting();
		} else {
			transfer();
		}
	}

	function createVesting() internal {
		uint256 cliff = vestingTerm.sub(now);
		uint256 duration = cliff;
		uint256 amount = investorsAmountsList[msg.sender];
		address vestingContractAddress;

		vestingContractAddress = vestingRegistry.getVesting(msg.sender);
		require(vestingContractAddress == address(0), "OriginInvestorsClaim::withdraw: investor has an active vesting contract");

		delete investorsAmountsList[msg.sender];

		vestingRegistry.createVesting(msg.sender, amount, cliff, duration);
		vestingContractAddress = vestingRegistry.getVesting(msg.sender);
		require(SOVToken.transfer(address(vestingRegistry), amount), "OriginInvestorsClaim::withdraw: SOV transfer failed");
		vestingRegistry.stakeTokens(vestingContractAddress, amount);

		emit ClaimVested(msg.sender, amount);
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
