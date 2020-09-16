from helpers import decode_log


def verify_sov_reward_payment(tx, FeesEvents, SOV, borrower, loan_id, sov_initial_balance, expected_events_number):
    tx.info()
    earn_reward_events = decode_log(tx, FeesEvents, 'EarnReward')
    print('len', len(earn_reward_events))
    assert(len(earn_reward_events) == expected_events_number)

    print('loan_id', loan_id)
    reward = 0
    for earn_reward_event in earn_reward_events:
        print('earn_reward_event', earn_reward_event['loanId'])
        assert(earn_reward_event['receiver'] == borrower)
        assert(earn_reward_event['token'] == SOV.address)
        assert(earn_reward_event['loanId'] == loan_id)
        reward += earn_reward_event['amount']

    assert(SOV.balanceOf(borrower) == sov_initial_balance + reward)
