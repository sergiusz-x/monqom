/** Converts an integer minor-unit amount into the two-decimal numeric API representation. */
export function centsToDisplayAmount(amountInCents: number): number {
    return Number((amountInCents / 100).toFixed(2))
}

/** Converts integer basis points into the concise numeric API percentage representation. */
export function basisPointsToDisplayPercentage(basisPoints: number): number {
    const sign = basisPoints < 0 ? '-' : ''
    const absoluteBasisPoints = Math.abs(basisPoints)
    const wholePart = Math.trunc(absoluteBasisPoints / 100)
    const fractionalPart = absoluteBasisPoints % 100

    if (fractionalPart === 0) {
        return Number(`${sign}${wholePart}`)
    }

    return Number(
        `${sign}${wholePart}.${fractionalPart.toString().padStart(2, '0').replace(/0+$/, '')}`,
    )
}
