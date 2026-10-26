export function markAllReviewed<T extends {reviewed?:boolean}>(rows:T[],hasError:(row:T)=>boolean):T[]{
 return rows.map(row=>({...row,reviewed:!hasError(row)}));
}
