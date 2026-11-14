import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as argon2 from 'argon2'

if (process.env.DATABASE_URL !== 'postgresql://screenshots:screenshots@postgres:5432/screenshots') {
    throw new Error('Screenshot seed requires the disposable screenshot database')
}

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
    const passwordHash = await argon2.hash('Screenshot-demo-2026!')
    const now = new Date()
    for (const locale of ['en', 'pl'] as const) {
        const workspaceId = `screenshots-${locale}`
        // This seed runs only in the disposable screenshot database.
        await prisma.workspace.deleteMany({ where: { id: workspaceId } })
        await prisma.user.deleteMany({ where: { email: `${locale}@example.test` } })
        const user = await prisma.user.create({
            data: {
                email: `${locale}@example.test`,
                name: 'Alex Morgan',
                locale,
                passwordHash,
                emailVerified: true,
            },
        })
        await prisma.workspace.create({
            data: {
                id: workspaceId,
                name: locale === 'pl' ? 'Dom' : 'Home',
                timezone: 'Europe/Warsaw',
                baseCurrency: 'PLN',
            },
        })
        const source = await prisma.paymentSource.create({
            data: {
                workspaceId,
                name: locale === 'pl' ? 'Karta codzienna' : 'Daily card',
                type: 'debit_card',
            },
        })
        await prisma.workspaceMembership.create({
            data: { workspaceId, userId: user.id, role: 'owner', lastPaymentSourceId: source.id },
        })
        const names =
            locale === 'pl'
                ? ['Zakupy spożywcze', 'Transport', 'Restauracje', 'Subskrypcje', 'Zdrowie']
                : ['Groceries', 'Transport', 'Restaurants', 'Subscriptions', 'Health']
        const descriptions =
            locale === 'pl'
                ? [
                      'Zakupy na tydzień',
                      'Bilet miejski',
                      'Kolacja z przyjaciółmi',
                      'Muzyka',
                      'Apteka',
                  ]
                : [
                      'Weekly groceries',
                      'City transport',
                      'Dinner with friends',
                      'Music subscription',
                      'Pharmacy',
                  ]
        const categories = await Promise.all(
            names.map((name, sortOrder) =>
                prisma.category.create({
                    data: {
                        workspaceId,
                        name,
                        sortOrder,
                        color: ['#8b5cf6', '#14b8a6', '#f59e0b', '#3b82f6', '#ec4899'][sortOrder],
                    },
                }),
            ),
        )
        const incomeCategory = await prisma.category.create({
            data: {
                workspaceId,
                name: locale === 'pl' ? 'Wynagrodzenie' : 'Salary',
                type: 'income',
                color: '#10b981',
            },
        })
        // Fictional single-person example, not a statistical average. Household spending
        // context: https://publikacje.new.stat.gov.pl/portal-publikacje/sytuacja-gospodarstw-domowych-w-2025-r-w-swietle-badania-budzetow-gospodarstw-domowych
        // Rental costs vary by location: https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q1/emea/poland-marketbeat-residential-q1-2026-pl.pdf
        // Indexed by months before the current month. Values are minor units.
        const incomeByMonth = [510000, 480000, 560000, 480000, 520000, 470000]
        const spendingByMonth = [
            [54000, 18500, 21500, 3999, 11800],
            [46000, 16500, 14800, 3999, 6500],
            [71000, 24500, 26000, 3999, 11200],
            [42000, 12000, 18800, 3999, 21500],
            [59000, 21000, 12500, 3999, 8700],
            [38000, 15500, 19500, 3999, 15800],
        ]
        for (let offset = 5; offset >= 0; offset--) {
            const incomeDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() - offset, 1))
            await prisma.transaction.create({
                data: {
                    workspaceId,
                    categoryId: incomeCategory.id,
                    paymentSourceId: source.id,
                    type: 'income',
                    amount: incomeByMonth[offset]!,
                    baseAmount: incomeByMonth[offset]!,
                    currency: 'PLN',
                    date: incomeDate,
                    description: locale === 'pl' ? 'Wynagrodzenie miesięczne' : 'Monthly salary',
                },
            })
            for (let i = 0; i < categories.length; i++) {
                const date = new Date(
                    Date.UTC(
                        now.getFullYear(),
                        now.getMonth() - offset,
                        Math.min(now.getDate(), 24) - i > 0 ? Math.min(now.getDate(), 24) - i : 1,
                    ),
                )
                const amount = spendingByMonth[offset]![i]!
                // Split monthly totals into plausible individual purchases while preserving budget totals.
                const parts = i === 0 ? [0.31, 0.26, 0.24, 0.19] : i === 2 ? [0.58, 0.42] : [1]
                let remaining = amount
                for (let part = 0; part < parts.length; part++) {
                    const value =
                        part === parts.length - 1 ? remaining : Math.round(amount * parts[part]!)
                    remaining -= value
                    const purchaseDate = new Date(date)
                    purchaseDate.setUTCDate(Math.max(1, date.getUTCDate() - part * 5))
                    await prisma.transaction.create({
                        data: {
                            workspaceId,
                            categoryId: categories[i]!.id,
                            paymentSourceId: source.id,
                            amount: value,
                            baseAmount: value,
                            currency: 'PLN',
                            date: purchaseDate,
                            description:
                                i === 0 && part > 0
                                    ? locale === 'pl'
                                        ? [
                                              'Zakupy na tydzień',
                                              'Warzywniak',
                                              'Piekarnia',
                                              'Zakupy do domu',
                                          ][part]!
                                        : [
                                              'Weekly groceries',
                                              'Produce market',
                                              'Bakery',
                                              'Household groceries',
                                          ][part]!
                                    : i === 2 && part === 1
                                      ? locale === 'pl'
                                          ? 'Lunch na mieście'
                                          : 'Lunch out'
                                      : descriptions[i]!,
                        },
                    })
                }
            }
        }
        // Additional everyday costs make the trend and recent activity more representative.
        const extraNames =
            locale === 'pl'
                ? ['Mieszkanie', 'Rachunki', 'Rozrywka']
                : ['Housing', 'Bills', 'Entertainment']
        const extraDescriptions =
            locale === 'pl'
                ? ['Wynajem mieszkania', 'Prąd i internet', 'Bilety na koncert']
                : ['Apartment rent', 'Electricity and internet', 'Concert tickets']
        const extraCosts = [
            [230000, 34500, 22500],
            [230000, 41000, 9500],
            [230000, 36500, 39000],
            [220000, 29000, 12000],
            [220000, 44000, 28000],
            [220000, 33500, 6000],
        ]
        for (let i = 0; i < extraNames.length; i++) {
            const category = await prisma.category.create({
                data: {
                    workspaceId,
                    name: extraNames[i]!,
                    sortOrder: i + names.length,
                    color: ['#6366f1', '#f97316', '#a855f7'][i],
                },
            })
            for (let offset = 5; offset >= 0; offset--) {
                const amount = extraCosts[offset]![i]!
                await prisma.transaction.create({
                    data: {
                        workspaceId,
                        categoryId: category.id,
                        paymentSourceId: source.id,
                        amount,
                        baseAmount: amount,
                        currency: 'PLN',
                        date: new Date(
                            Date.UTC(
                                now.getFullYear(),
                                now.getMonth() - offset,
                                Math.min(now.getDate(), 12 - i * 3),
                            ),
                        ),
                        description: extraDescriptions[i]!,
                    },
                })
            }
        }
        // An uncategorized transaction illustrates the review workflow.
        await prisma.transaction.create({
            data: {
                workspaceId,
                paymentSourceId: source.id,
                amount: 4890,
                baseAmount: 4890,
                currency: 'PLN',
                date: new Date(
                    Date.UTC(now.getFullYear(), now.getMonth(), Math.min(now.getDate(), 15)),
                ),
                description: locale === 'pl' ? 'Kawa i śniadanie' : 'Coffee and breakfast',
            },
        })
        for (let i = 0; i < 3; i++) {
            const amount = [90000, 22000, 18000][i]!
            await prisma.budget.create({
                data: {
                    workspaceId,
                    categoryId: categories[i]!.id,
                    amount,
                    baseAmount: amount,
                    currency: 'PLN',
                    year: now.getFullYear(),
                    month: now.getMonth() + 1,
                },
            })
        }
        await prisma.goal.create({
            data: {
                workspaceId,
                name: locale === 'pl' ? 'Fundusz awaryjny' : 'Emergency fund',
                targetAmount: 1200000,
                initialAmount: 840000,
                currency: 'PLN',
                planStartMonth: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)),
                targetDate: new Date(Date.UTC(now.getFullYear(), now.getMonth() + 12, 1)),
            },
        })
        await prisma.goal.create({
            data: {
                workspaceId,
                name: locale === 'pl' ? 'Wakacje' : 'Holiday',
                targetAmount: 600000,
                initialAmount: 180000,
                currency: 'PLN',
                planStartMonth: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)),
                targetDate: new Date(Date.UTC(now.getFullYear(), now.getMonth() + 8, 1)),
            },
        })
    }
}
main().finally(() => prisma.$disconnect())
