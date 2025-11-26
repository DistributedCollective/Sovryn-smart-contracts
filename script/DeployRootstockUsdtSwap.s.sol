// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import { RootstockUsdtSwap } from "../contracts/token/RootstockUsdtSwap.sol";

contract DeployRootstockUsdtSwap is Script {
    function run() external {
        // Set your deployment addresses here
        address rusdtReceiver = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        address usdt0Provider = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        address rescuer = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;

        vm.startBroadcast();
        new RootstockUsdtSwap(rusdtReceiver, usdt0Provider, rescuer);
        vm.stopBroadcast();
    }
}
