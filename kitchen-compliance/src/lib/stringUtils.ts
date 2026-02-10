/**
 * String Utility Functions
 */

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching wake words and commands
 */
export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    // Increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i]
    }

    // Increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                )
            }
        }
    }

    return matrix[b.length][a.length]
}

/**
 * Check if a text is "like" a target string, allowing for some errors
 * @param text The text to check (e.g. transcript)
 * @param target The target string (e.g. wake word)
 * @param threshold Max allowed distance (default 2)
 */
export function isLike(text: string, target: string, threshold = 2): boolean {
    const cleanText = text.toLowerCase().trim()
    const cleanTarget = target.toLowerCase().trim()

    // Exact match shortcut
    if (cleanText.includes(cleanTarget)) return true

    // For very short targets, be stricter
    if (cleanTarget.length <= 4) {
        return cleanText === cleanTarget
    }

    // Check distance
    const distance = levenshteinDistance(cleanText, cleanTarget)
    return distance <= threshold
}
