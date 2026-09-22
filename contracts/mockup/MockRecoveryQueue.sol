// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

/**
 * The reads `perimeter:refund` and `perimeter:route:*` make on the queue, plus
 * the five recovery calls they submit, so a task's own read-back of what it
 * submitted can be exercised without a chain. Values are set directly by the
 * test and no predicate is enforced here — the predicates live on the real
 * queue and are exercised on a fork; what this stands in for is the state each
 * call leaves behind.
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
    mapping(bytes32 => bool) private feasibilityUnreadable;
    mapping(bytes32 => bool) private routeKnown;
    mapping(address => uint256[]) private activeIds;
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
        _addActive(originator, id);
        _addActive(positionOwner, id);
        _addActive(receiver, id);
    }

    function _addActive(address party, uint256 id) private {
        uint256[] storage set = activeIds[party];
        for (uint256 i = 0; i < set.length; i++) {
            if (set[i] == id) return;
        }
        set.push(id);
    }

    function _removeActive(address party, uint256 id) private {
        uint256[] storage set = activeIds[party];
        for (uint256 i = 0; i < set.length; i++) {
            if (set[i] == id) {
                set[i] = set[set.length - 1];
                set.length--;
                return;
            }
        }
    }

    function _settle(uint256[] memory ids, uint8 status) private {
        for (uint256 i = 0; i < ids.length; i++) {
            ExitRequest storage r = requests[ids[i]];
            // The real queue reverts UnknownRequest here; this leaves the id
            // alone, so a task's read-back has an unsettled request to find.
            if (r.status == 0) continue;
            r.status = status;
            _removeActive(r.originator, ids[i]);
            _removeActive(r.owner, ids[i]);
            _removeActive(r.receiver, ids[i]);
        }
    }

    function resolveToProtocol(uint256[] calldata ids, bytes32) external {
        _settle(ids, 3);
    }

    function resolveByOwner(uint256[] calldata ids, address) external {
        _settle(ids, 4);
    }

    function setRecoveryRoute(RecoveryRoute memory route) public returns (bytes32 id) {
        id = keccak256(
            abi.encode(route.surfaceId, route.subProduct, route.token, route.destination)
        );
        if (!routeKnown[id]) {
            routeKnown[id] = true;
            routeIds.push(id);
        }
        routes[id] = route;
    }

    function removeRecoveryRoute(bytes32 id) external {
        delete routes[id];
    }

    function getActive(
        address party,
        uint256 cursor,
        uint256 n
    ) external view returns (uint256[] memory ids, uint256 nextCursor) {
        uint256[] storage set = activeIds[party];
        if (cursor >= set.length || n == 0) return (new uint256[](0), 0);
        uint256 end = cursor + n;
        if (end > set.length) end = set.length;
        ids = new uint256[](end - cursor);
        for (uint256 i = cursor; i < end; i++) {
            ids[i - cursor] = set[i];
        }
        nextCursor = end >= set.length ? 0 : end;
    }

    function setBlockState(address a, uint8 state) external {
        blockStates[a] = state;
    }

    function setWrbtc(address w) external {
        wrbtc = w;
    }

    function setRoles(address newAdmin, address newOwner) external {
        admin = newAdmin;
        owner = newOwner;
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
        if (!routeKnown[id]) {
            routeKnown[id] = true;
            routeIds.push(id);
        }
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
        require(!feasibilityUnreadable[surfaceId], "MockRecoveryQueue: feasibility unavailable");
        return feasible[surfaceId];
    }

    /// @notice Make one surface's feasibility read revert, for a caller that
    ///         must carry on past a read that does not answer.
    function setFeasibilityUnreadable(bytes32 surfaceId, bool value) external {
        feasibilityUnreadable[surfaceId] = value;
    }

    /// @notice Store a route under an id that is NOT the hash of its own four
    ///         fields, for a caller that cross-checks the two.
    function forceRoute(
        bytes32 id,
        bool active,
        bytes32 surfaceId,
        address subProduct,
        address token,
        address destination,
        bool topUpPool
    ) external {
        if (!routeKnown[id]) {
            routeKnown[id] = true;
            routeIds.push(id);
        }
        routes[id] = RecoveryRoute(active, surfaceId, subProduct, token, destination, topUpPool);
    }
}
