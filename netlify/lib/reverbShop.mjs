// How many live listings Luke's Reverb shop has, from Reverb's public API. The
// nav shows Gear Shop only while there's something in the shop.

const SHOP = 'lukes-gear-emporium-220'

export async function fetchShopListingCount() {
  const response = await fetch(`https://api.reverb.com/api/listings/all?shop=${SHOP}&per_page=1`, {
    headers: { 'Accept-Version': '3.0', Accept: 'application/hal+json' },
  })
  if (!response.ok) throw new Error(`Reverb answered ${response.status}`)
  const { total } = await response.json()
  if (typeof total !== 'number') throw new Error('Reverb gave no listing count')
  return total
}
