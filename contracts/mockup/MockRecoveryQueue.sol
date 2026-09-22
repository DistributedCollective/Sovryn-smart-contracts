// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

/**
 * The reads `perimeter:refund` and `perimeter:route:*` make on the queue, and
 * nothing else. Values are set directly by the test; no predicate is enforced
 * here, because the predicates live on the real queue and are exercised on a
 * fork.
 */
contract MockRecoveryQueue {
    struct ExitRequest {
        uint128 amount;
        uint64 createdAt;
        uint64 unlockAt;
        address originator;
        address owner;
        address receiver;
        address token;
        bytes32 surfaceId;
        address subProduct;
        uint8 status;
        bool unwrapOnDelivery;
    }
    struct RecoveryRoute {
        bool active;
        bytes32 surfaceId;
        address subProduct;
        address token;
        address destination;
        bool topUpPool;
    }

    mapping(uint256 => ExitRequest) private requests;
    mapping(address => uint8) private blockStates;
    mapping(bytes32 => RecoveryRoute) private routes;
    mapping(bytes32 => bool) private feasible;
    bytes32[] private routeIds;

    address public admin;
    address public owner;
    address public wrbtc;
    bool public securityPerimeterPaused;

    function setRequest(
        uint256 id,
        address originator,
        address positionOwner,
        address receiver,
        bytes32 surfaceId,
        address subProduct,
        address token,
        uint8 status
    ) external {
        ExitRequest storage r = requests[id];
        r.amount = 1 ether;
        r.originator = originator;
        r.owner = positionOwner;
        r.receiver = receiver;
        r.surfaceId = surfaceId;
        r.subProduct = subProduct;
        r.token = token;
        r.status = status;
    }

    function setBlockState(address a, uint8 state) external {
        blockStates[a] = state;
    }

    function setRoute(
        bool active,
        bytes32 surfaceId,
        address subProduct,
        address token,
        address destination,
        bool topUpPool
    ) external {
        bytes32 id = keccak256(abi.encode(surfaceId, subProduct, token, destination));
        if (!routes[id].active) routeIds.push(id);
        routes[id] = RecoveryRoute(active, surfaceId, subProduct, token, destination, topUpPool);
    }

    function setTopUpFeasible(bytes32 surfaceId, bool value) external {
        feasible[surfaceId] = value;
    }

    function getRequest(uint256 id) external view returns (ExitRequest memory) {
        return requests[id];
    }

    function blockStateOf(address a) external view returns (uint8) {
        return blockStates[a];
    }

    function getRecoveryRoute(bytes32 id) external view returns (RecoveryRoute memory) {
        return routes[id];
    }

    function recoveryRouteIds() external view returns (bytes32[] memory) {
        return routeIds;
    }

    function topUpFeasible(bytes32 surfaceId) external view returns (bool) {
        return feasible[surfaceId];
    }
}
