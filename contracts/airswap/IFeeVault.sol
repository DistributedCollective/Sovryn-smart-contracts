pragma solidity 0.5.17;

interface IFeeVault {
    function sendFunds(
        address token,
        address recipient,
        uint256 amount
    ) external returns (bool);
}
