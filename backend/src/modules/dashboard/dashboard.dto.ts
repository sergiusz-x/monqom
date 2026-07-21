import { Matches } from 'class-validator'

export class DashboardMonthQueryDto {
    @Matches(/^\d{4}-\d{2}$/)
    month!: string
}
