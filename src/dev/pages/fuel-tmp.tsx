// TEMPORARY (fuel engineer): visual check of the home mini card; deleted after screenshots.
import { TodayNutritionCard } from '../../features/fuel/TodayNutritionCard'
export default function FuelTmp() {
  return (
    <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 390 }}>
      <TodayNutritionCard memberId="demo-stelios" />
      <TodayNutritionCard memberId="demo-thanos" />
      <TodayNutritionCard memberId="demo-dennis" />
    </div>
  )
}
