// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

import "../openzeppelin/SafeMath.sol";

/**
 * @title  TestTokenNoReturn — USDT-style no-return ERC20.
 * @notice A deliberately NON-STANDARD ERC20 whose `approve`, `transfer` and
 *         `transferFrom` return NOTHING (no `bool`), mirroring USDT and other
 *         "weird" mainnet tokens. It exists solely to regression-test that the
 *         ColFee delayed-exit path (`_safeApprove` / the queue's safe pull)
 *         tolerates no-return underlyings — a raw high-level `.approve()` /
 *         `.transferFrom()` would revert on decode against these signatures.
 *
 * @dev    `approve` additionally enforces USDT's zero-first guard
 *         (non-zero → non-zero reverts), so the test also proves the
 *         delayed-exit invariant that the approved allowance returns to 0
 *         after each queue pull (no dangling allowance / no double-approve
 *         revert).
 */
contract TestTokenNoReturn {
    using SafeMath for uint256;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    string public name;
    string public symbol;
    uint8 public decimals;

    mapping(address => uint256) internal balances;
    mapping(address => mapping(address => uint256)) internal allowed;
    uint256 internal totalSupply_;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialAmount
    ) public {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        if (_initialAmount != 0) {
            mint(msg.sender, _initialAmount);
        }
    }

    /// @dev USDT-style: no return value + zero-first (non-zero → non-zero) guard.
    function approve(address _spender, uint256 _value) public {
        require(
            _value == 0 || allowed[msg.sender][_spender] == 0,
            "TestTokenNoReturn: approve from non-zero to non-zero allowance"
        );
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
    }

    /// @dev USDT-style: no return value.
    function transfer(address _to, uint256 _value) public {
        require(_value <= balances[msg.sender] && _to != address(0), "invalid transfer");
        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
    }

    /// @dev USDT-style: no return value.
    function transferFrom(address _from, address _to, uint256 _value) public {
        uint256 allowanceAmount = allowed[_from][msg.sender];
        require(
            _value <= balances[_from] && _value <= allowanceAmount && _to != address(0),
            "invalid transfer"
        );
        balances[_from] = balances[_from].sub(_value);
        balances[_to] = balances[_to].add(_value);
        if (allowanceAmount < uint256(-1)) {
            allowed[_from][msg.sender] = allowanceAmount.sub(_value);
        }
        emit Transfer(_from, _to, _value);
    }

    function mint(address _to, uint256 _value) public {
        require(_to != address(0), "no burn allowed");
        totalSupply_ = totalSupply_.add(_value);
        balances[_to] = balances[_to].add(_value);
        emit Transfer(address(0), _to, _value);
    }

    function totalSupply() public view returns (uint256) {
        return totalSupply_;
    }

    function balanceOf(address _owner) public view returns (uint256) {
        return balances[_owner];
    }

    function allowance(address _owner, address _spender) public view returns (uint256) {
        return allowed[_owner][_spender];
    }
}
