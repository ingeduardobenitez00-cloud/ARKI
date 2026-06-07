/**
 * Electoral Calculation Utilities for Paraguay (D'Hondt & Preferential Vote)
 */

export interface ListResult {
    id: string;
    name: string;
    totalVotes: number;
    options: Record<string, number>;
}

export interface DHondtResult {
    listId: string;
    listName: string;
    seats: number;
    quotients: number[];
}

/**
 * Calculates seat distribution using the D'Hondt method.
 * @param lists Array of list results
 * @param totalSeats Number of seats to distribute (typically 24 for Junta Municipal)
 */
export function calculateDHondt(lists: ListResult[], totalSeats: number = 24): DHondtResult[] {
    const table: { listId: string; listName: string; quotient: number }[] = [];

    // 1. Generate all quotients (Total / 1, Total / 2, ..., Total / N)
    lists.forEach(list => {
        for (let i = 1; i <= totalSeats; i++) {
            table.push({
                listId: list.id,
                listName: list.name,
                quotient: list.totalVotes / i
            });
        }
    });

    // 2. Sort all quotients descending
    table.sort((a, b) => b.quotient - a.quotient);

    // 3. Take the top N quotients
    const winners = table.slice(0, totalSeats);

    // 4. Count seats per list
    return lists.map(list => {
        const listWinners = winners.filter(w => w.listId === list.id);
        const listSeats = listWinners.length;
        // The quotients are already sorted descending because `winners` is sorted descending.
        const listQuotients = listWinners.map(w => w.quotient);
            
        return {
            listId: list.id,
            listName: list.name,
            seats: listSeats,
            quotients: listQuotients
        };
    });
}

/**
 * Re-ranks candidates within a list based on preferential votes.
 * @param list The list result containing option votes
 * @param candidates Original candidate metadata for this list
 */
export function rankCandidatesByPreferential(options: Record<string, number>, candidates: any[]) {
    return [...candidates].map(c => ({
        ...c,
        votes: options[c.id] || options[c.option] || 0
    })).sort((a, b) => {
        if (b.votes !== a.votes) {
            return b.votes - a.votes; // High votes first
        }
        return a.option - b.option; // Original order if tied
    });
}
