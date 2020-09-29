import eth_event
from brownie.convert.normalize import format_event
from brownie.network.event import EventDict


def decode_log(tx, contract, event_name):
    """
    Get transaction logs for specific event name
    :param tx: transaction object
    :param contract: Contract object
    :param event_name: name of the event
    :return: EventDict with the events parsed
    """
    topic_map = eth_event.get_topic_map(contract.abi)
    logs = eth_event.decode_logs(tx.logs, topic_map, True)
    events = list(filter(lambda tx_: tx_['name'] == event_name, logs))
    return EventDict([format_event(i) for i in events])[event_name]
