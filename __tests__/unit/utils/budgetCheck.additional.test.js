const cache = require('../../../src/services/cache');
const budgetCheck = require('../../../src/utils/budgetCheck');

jest.mock('../../../src/services/cache');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isBudgetWarning additional cases', () => {
  test('production mode fetches usage when cache miss', async () => {
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(true);
    jest.spyOn(budgetCheck, 'getBudgetUsage').mockResolvedValue(0.9);
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const result = await budgetCheck.isBudgetWarning();

    expect(budgetCheck.getBudgetUsage).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalled();
    expect(result).toBe(true);
    process.env.NODE_ENV = origEnv;
  });

  test('env flag forces warning', async () => {
    cache.get.mockResolvedValue(null);
    process.env.TEST_BUDGET_WARNING = 'true';
    const result = await budgetCheck.isBudgetWarning();
    expect(result).toBe(true);
    delete process.env.TEST_BUDGET_WARNING;
  });
});


