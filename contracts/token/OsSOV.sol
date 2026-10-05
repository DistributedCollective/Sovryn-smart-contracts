// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20, ERC20Capped } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title Sovryn Token for BitcoinOS: a 'coupon token' to be transitioned to BitcoinOS.
 *
 * @notice This contract accounts for all holders' balances.
 *
 * @dev This contract represents a token with dynamic supply.
 *   The owner of the token contract can mint/burn tokens to/from any account
 *   based upon previous governance voting and approval.
 *
 */
contract OsSOV is ERC20Capped, AccessControl, Ownable, Initializable {
    string private constant _NAME = "BitcoinOS Sovryn Transition Token";
    string private constant _SYMBOL = "osSOV";
    uint8 private constant _DECIMALS = 18;

    bytes32 public constant AUTHORISED_MINTER_ROLE = keccak256("AUTHORISED_MINTER_ROLE");

    /**
     * @dev The token is non transferable.
     */
    error NonTransferable();

    /**
     * @dev The token is non transferable via transferForm - approval is not allowed.
     */
    error NonApprovable();

    /**
     * @dev The token is non receivable
     */
    error NonReceivable();

    /**
     * @dev address passed cannot be zero
     */
    error NotAllowedZeroAddressForParam(string param);

    modifier onlyMinter(address _address) {
        require(hasRole(AUTHORISED_MINTER_ROLE, _address), "Not authorised to mint");
        _;
    }

    /**
     * @dev _disableInitializers locks the logic contract, preventing any future reinitialization. This cannot be part of an initializer call.
     * Calling this in the constructor of a contract will prevent that contract from being initialized or reinitialized
     * to any version. It is recommended to use this to lock implementation contracts that are designed to be called
     * through proxies.
     * @dev initializing Owner with address(1) because 0 address is not allowed
     */
    constructor() ERC20(_NAME, _SYMBOL) ERC20Capped(100_000_000 ether) {
        _disableInitializers();
    }

    /**
     * @param _owner Address for AccessControl OWNER_ROLE to use in onlyOwner() modifier
     * @param _defaultAdmin Address for AcccessControl DEFAULT_ADMIN_ROLE to manage roles: assign and revoke
     * @param _authorizedMinter Address of the minter - Staking Rewards contract
     */
    function initialize(
        address _owner,
        address _defaultAdmin,
        address _authorizedMinter
    ) external initializer {
        if (_defaultAdmin == address(0)) {
            revert NotAllowedZeroAddressForParam("_defaultAdmin");
        }
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);

        if (_authorizedMinter != address(0)) {
            _grantRole(AUTHORISED_MINTER_ROLE, _authorizedMinter);
        }

        if (_owner == address(0)) {
            revert NotAllowedZeroAddressForParam("_owner");
        }
        _transferOwnership(_owner);
    }

    /**
     * @param _adminRole Address for AcccessControl DEFAULT_ADMIN_ROLE to manage roles: assign and revoke
     */
    function setDefaultAdminRole(address _adminRole) external onlyOwner {
        _grantRole(DEFAULT_ADMIN_ROLE, _adminRole);
    }

    /**
     * @param _authorizedMinter Address of the minter - should be Staking Rewards contract
     */
    function setAuthorisedMinterRole(address _authorizedMinter) external onlyOwner {
        _grantRole(AUTHORISED_MINTER_ROLE, _authorizedMinter);
    }

    /**
     * @dev Creates a `value` amount of tokens and assigns them to `account`, by transferring it from address(0).
     * Relies on the `_update` mechanism
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * NOTE: This function is not override, {_update} should be overridden instead.
     */
    function mint(address _to, uint256 _amount) public onlyMinter(msg.sender) {
        _mint(_to, _amount);
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     * - non-transferable
     */
    function transfer(address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `value` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * - non-transferable via transferFrom
     */
    function approve(address, uint256) public override returns (bool) {
        revert NonApprovable();
    }

    /**
     * @dev Token is non-receivable
     */
    receive() external payable {
        revert NonReceivable();
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public pure override returns (string memory) {
        return _NAME;
    }

    /**
     * @return Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public pure override returns (string memory) {
        return _SYMBOL;
    }

    /**
     * @return Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the default value returned by this function, unless
     * it's overridden.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
}
