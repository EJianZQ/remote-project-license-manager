<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Activity, CalendarDays, ChevronRight, FileClock, FolderPlus, RefreshCcw, ShieldCheck } from 'lucide-vue-next'
import type { SelectOption } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getDailyAccessLogStats, getTodayAccessLogStats } from '@/api/logs'
import { getProjects } from '@/api/projects'
import type { DailyAccessLogStats, ProjectListItem, ProjectStatus, TodayAccessLogStats } from '@/api/types'
import AccessTrendChart from '@/components/common/AccessTrendChart.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { formatDateTime } from '@/utils/format'

const projectLoading = ref(false)
const accessStatsLoading = ref(false)
const errorText = ref('')
const accessStatsErrorText = ref('')
const projects = ref<ProjectListItem[]>([])
const totalProjects = ref(0)
const todayAccessStats = ref<TodayAccessLogStats | null>(null)
const dailyAccessStats = ref<DailyAccessLogStats | null>(null)
const loadedAccessStatsTimezone = ref<string | null>(null)
const dailyDays = ref<7 | 14 | 30>(7)
const dashboardPageSize = 100
let dashboardRequestId = 0
let accessStatsRequestId = 0
const { t } = useI18n()

const statusCards: ProjectStatus[] = ['active', 'grace', 'expired', 'suspended']
const defaultTimezone = 'Asia/Shanghai'
const timezoneStorageKey = 'license_console_access_stats_timezone'
const timezoneInitialOptionLimit = 40
const timezoneOptionBatchSize = 80
const fallbackTimezoneValues = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Jakarta',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Riyadh',
  'Asia/Tehran',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
  'Pacific/Chatham',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'Europe/Istanbul',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Halifax',
  'America/Phoenix',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'America/Santiago',
  'America/Bogota',
  'America/Lima',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
] as const
const timezoneCountryOverrides: Record<string, string> = {
  UTC: 'un',
  'Etc/UTC': 'un',
  'Africa/Abidjan': 'ci',
  'Africa/Accra': 'gh',
  'Africa/Addis_Ababa': 'et',
  'Africa/Algiers': 'dz',
  'Africa/Asmera': 'er',
  'Africa/Bamako': 'ml',
  'Africa/Bangui': 'cf',
  'Africa/Banjul': 'gm',
  'Africa/Bissau': 'gw',
  'Africa/Blantyre': 'mw',
  'Africa/Brazzaville': 'cg',
  'Africa/Bujumbura': 'bi',
  'Africa/Cairo': 'eg',
  'Africa/Casablanca': 'ma',
  'Africa/Ceuta': 'es',
  'Africa/Conakry': 'gn',
  'Africa/Dakar': 'sn',
  'Africa/Dar_es_Salaam': 'tz',
  'Africa/Djibouti': 'dj',
  'Africa/Douala': 'cm',
  'Africa/El_Aaiun': 'eh',
  'Africa/Freetown': 'sl',
  'Africa/Gaborone': 'bw',
  'Africa/Harare': 'zw',
  'Africa/Johannesburg': 'za',
  'Africa/Juba': 'ss',
  'Africa/Kampala': 'ug',
  'Africa/Khartoum': 'sd',
  'Africa/Kigali': 'rw',
  'Africa/Kinshasa': 'cd',
  'Africa/Lagos': 'ng',
  'Africa/Libreville': 'ga',
  'Africa/Lome': 'tg',
  'Africa/Luanda': 'ao',
  'Africa/Lubumbashi': 'cd',
  'Africa/Lusaka': 'zm',
  'Africa/Malabo': 'gq',
  'Africa/Maputo': 'mz',
  'Africa/Maseru': 'ls',
  'Africa/Mbabane': 'sz',
  'Africa/Mogadishu': 'so',
  'Africa/Monrovia': 'lr',
  'Africa/Nairobi': 'ke',
  'Africa/Ndjamena': 'td',
  'Africa/Niamey': 'ne',
  'Africa/Nouakchott': 'mr',
  'Africa/Ouagadougou': 'bf',
  'Africa/Porto-Novo': 'bj',
  'Africa/Sao_Tome': 'st',
  'Africa/Tripoli': 'ly',
  'Africa/Tunis': 'tn',
  'Africa/Windhoek': 'na',
  'America/Anchorage': 'us',
  'America/Adak': 'us',
  'America/Anguilla': 'ai',
  'America/Antigua': 'ag',
  'America/Araguaina': 'br',
  'America/Aruba': 'aw',
  'America/Asuncion': 'py',
  'America/Bahia': 'br',
  'America/Bahia_Banderas': 'mx',
  'America/Barbados': 'bb',
  'America/Belem': 'br',
  'America/Belize': 'bz',
  'America/Blanc-Sablon': 'ca',
  'America/Boa_Vista': 'br',
  'America/Bogota': 'co',
  'America/Boise': 'us',
  'America/Buenos_Aires': 'ar',
  'America/Cambridge_Bay': 'ca',
  'America/Campo_Grande': 'br',
  'America/Cancun': 'mx',
  'America/Caracas': 've',
  'America/Catamarca': 'ar',
  'America/Cayenne': 'gf',
  'America/Cayman': 'ky',
  'America/Chicago': 'us',
  'America/Chihuahua': 'mx',
  'America/Ciudad_Juarez': 'mx',
  'America/Coral_Harbour': 'ca',
  'America/Cordoba': 'ar',
  'America/Costa_Rica': 'cr',
  'America/Creston': 'ca',
  'America/Cuiaba': 'br',
  'America/Curacao': 'cw',
  'America/Danmarkshavn': 'gl',
  'America/Dawson': 'ca',
  'America/Dawson_Creek': 'ca',
  'America/Denver': 'us',
  'America/Detroit': 'us',
  'America/Dominica': 'dm',
  'America/Edmonton': 'ca',
  'America/Eirunepe': 'br',
  'America/El_Salvador': 'sv',
  'America/Fort_Nelson': 'ca',
  'America/Fortaleza': 'br',
  'America/Glace_Bay': 'ca',
  'America/Goose_Bay': 'ca',
  'America/Godthab': 'gl',
  'America/Grand_Turk': 'tc',
  'America/Grenada': 'gd',
  'America/Guadeloupe': 'gp',
  'America/Guatemala': 'gt',
  'America/Guayaquil': 'ec',
  'America/Guyana': 'gy',
  'America/Halifax': 'ca',
  'America/Havana': 'cu',
  'America/Hermosillo': 'mx',
  'America/Indianapolis': 'us',
  'America/Inuvik': 'ca',
  'America/Iqaluit': 'ca',
  'America/Jamaica': 'jm',
  'America/Jujuy': 'ar',
  'America/Juneau': 'us',
  'America/Kralendijk': 'bq',
  'America/La_Paz': 'bo',
  'America/Lima': 'pe',
  'America/Los_Angeles': 'us',
  'America/Louisville': 'us',
  'America/Lower_Princes': 'sx',
  'America/Maceio': 'br',
  'America/Managua': 'ni',
  'America/Manaus': 'br',
  'America/Marigot': 'mf',
  'America/Martinique': 'mq',
  'America/Matamoros': 'mx',
  'America/Mazatlan': 'mx',
  'America/Menominee': 'us',
  'America/Merida': 'mx',
  'America/Mendoza': 'ar',
  'America/Metlakatla': 'us',
  'America/Mexico_City': 'mx',
  'America/Miquelon': 'pm',
  'America/Moncton': 'ca',
  'America/Monterrey': 'mx',
  'America/Montevideo': 'uy',
  'America/Montserrat': 'ms',
  'America/Nassau': 'bs',
  'America/New_York': 'us',
  'America/Nome': 'us',
  'America/Noronha': 'br',
  'America/Nuuk': 'gl',
  'America/Ojinaga': 'mx',
  'America/Panama': 'pa',
  'America/Paramaribo': 'sr',
  'America/Phoenix': 'us',
  'America/Port-au-Prince': 'ht',
  'America/Port_of_Spain': 'tt',
  'America/Porto_Velho': 'br',
  'America/Puerto_Rico': 'pr',
  'America/Punta_Arenas': 'cl',
  'America/Rankin_Inlet': 'ca',
  'America/Recife': 'br',
  'America/Regina': 'ca',
  'America/Resolute': 'ca',
  'America/Rio_Branco': 'br',
  'America/Santarem': 'br',
  'America/Santiago': 'cl',
  'America/Santo_Domingo': 'do',
  'America/Sao_Paulo': 'br',
  'America/Scoresbysund': 'gl',
  'America/Sitka': 'us',
  'America/St_Barthelemy': 'bl',
  'America/St_Johns': 'ca',
  'America/St_Kitts': 'kn',
  'America/St_Lucia': 'lc',
  'America/St_Thomas': 'vi',
  'America/St_Vincent': 'vc',
  'America/Swift_Current': 'ca',
  'America/Tegucigalpa': 'hn',
  'America/Thule': 'gl',
  'America/Tijuana': 'mx',
  'America/Toronto': 'ca',
  'America/Tortola': 'vg',
  'America/Vancouver': 'ca',
  'America/Whitehorse': 'ca',
  'America/Winnipeg': 'ca',
  'America/Yakutat': 'us',
  'America/Yellowknife': 'ca',
  'Arctic/Longyearbyen': 'sj',
  'Asia/Aden': 'ye',
  'Asia/Almaty': 'kz',
  'Asia/Amman': 'jo',
  'Asia/Anadyr': 'ru',
  'Asia/Aqtau': 'kz',
  'Asia/Aqtobe': 'kz',
  'Asia/Ashgabat': 'tm',
  'Asia/Atyrau': 'kz',
  'Asia/Baghdad': 'iq',
  'Asia/Bahrain': 'bh',
  'Asia/Baku': 'az',
  'Asia/Bangkok': 'th',
  'Asia/Barnaul': 'ru',
  'Asia/Beirut': 'lb',
  'Asia/Bishkek': 'kg',
  'Asia/Brunei': 'bn',
  'Asia/Calcutta': 'in',
  'Asia/Chita': 'ru',
  'Asia/Choibalsan': 'mn',
  'Asia/Colombo': 'lk',
  'Asia/Damascus': 'sy',
  'Asia/Dhaka': 'bd',
  'Asia/Dili': 'tl',
  'Asia/Dubai': 'ae',
  'Asia/Dushanbe': 'tj',
  'Asia/Famagusta': 'cy',
  'Asia/Gaza': 'ps',
  'Asia/Hebron': 'ps',
  'Asia/Ho_Chi_Minh': 'vn',
  'Asia/Hong_Kong': 'hk',
  'Asia/Hovd': 'mn',
  'Asia/Irkutsk': 'ru',
  'Asia/Jakarta': 'id',
  'Asia/Jayapura': 'id',
  'Asia/Jerusalem': 'il',
  'Asia/Kabul': 'af',
  'Asia/Kamchatka': 'ru',
  'Asia/Karachi': 'pk',
  'Asia/Katmandu': 'np',
  'Asia/Khandyga': 'ru',
  'Asia/Kolkata': 'in',
  'Asia/Krasnoyarsk': 'ru',
  'Asia/Kuala_Lumpur': 'my',
  'Asia/Kuching': 'my',
  'Asia/Kuwait': 'kw',
  'Asia/Macau': 'mo',
  'Asia/Magadan': 'ru',
  'Asia/Makassar': 'id',
  'Asia/Manila': 'ph',
  'Asia/Muscat': 'om',
  'Asia/Nicosia': 'cy',
  'Asia/Novokuznetsk': 'ru',
  'Asia/Novosibirsk': 'ru',
  'Asia/Omsk': 'ru',
  'Asia/Oral': 'kz',
  'Asia/Phnom_Penh': 'kh',
  'Asia/Pontianak': 'id',
  'Asia/Pyongyang': 'kp',
  'Asia/Qatar': 'qa',
  'Asia/Qostanay': 'kz',
  'Asia/Qyzylorda': 'kz',
  'Asia/Rangoon': 'mm',
  'Asia/Riyadh': 'sa',
  'Asia/Sakhalin': 'ru',
  'Asia/Samarkand': 'uz',
  'Asia/Saigon': 'vn',
  'Asia/Seoul': 'kr',
  'Asia/Shanghai': 'cn',
  'Asia/Singapore': 'sg',
  'Asia/Srednekolymsk': 'ru',
  'Asia/Taipei': 'tw',
  'Asia/Tashkent': 'uz',
  'Asia/Tbilisi': 'ge',
  'Asia/Tehran': 'ir',
  'Asia/Thimphu': 'bt',
  'Asia/Tokyo': 'jp',
  'Asia/Tomsk': 'ru',
  'Asia/Ulaanbaatar': 'mn',
  'Asia/Urumqi': 'cn',
  'Asia/Ust-Nera': 'ru',
  'Asia/Vientiane': 'la',
  'Asia/Vladivostok': 'ru',
  'Asia/Yakutsk': 'ru',
  'Asia/Yangon': 'mm',
  'Asia/Yekaterinburg': 'ru',
  'Asia/Yerevan': 'am',
  'Atlantic/Azores': 'pt',
  'Atlantic/Bermuda': 'bm',
  'Atlantic/Canary': 'es',
  'Atlantic/Cape_Verde': 'cv',
  'Atlantic/Faeroe': 'fo',
  'Atlantic/Madeira': 'pt',
  'Atlantic/Reykjavik': 'is',
  'Atlantic/South_Georgia': 'gs',
  'Atlantic/St_Helena': 'sh',
  'Atlantic/Stanley': 'fk',
  'Australia/Sydney': 'au',
  'Europe/Amsterdam': 'nl',
  'Europe/Andorra': 'ad',
  'Europe/Astrakhan': 'ru',
  'Europe/Athens': 'gr',
  'Europe/Belgrade': 'rs',
  'Europe/Berlin': 'de',
  'Europe/Bratislava': 'sk',
  'Europe/Brussels': 'be',
  'Europe/Bucharest': 'ro',
  'Europe/Budapest': 'hu',
  'Europe/Busingen': 'de',
  'Europe/Chisinau': 'md',
  'Europe/Copenhagen': 'dk',
  'Europe/Dublin': 'ie',
  'Europe/Gibraltar': 'gi',
  'Europe/Guernsey': 'gg',
  'Europe/Helsinki': 'fi',
  'Europe/Isle_of_Man': 'im',
  'Europe/Istanbul': 'tr',
  'Europe/Jersey': 'je',
  'Europe/Kaliningrad': 'ru',
  'Europe/Kirov': 'ru',
  'Europe/Kiev': 'ua',
  'Europe/Kyiv': 'ua',
  'Europe/Lisbon': 'pt',
  'Europe/Ljubljana': 'si',
  'Europe/London': 'gb',
  'Europe/Luxembourg': 'lu',
  'Europe/Madrid': 'es',
  'Europe/Malta': 'mt',
  'Europe/Mariehamn': 'ax',
  'Europe/Minsk': 'by',
  'Europe/Monaco': 'mc',
  'Europe/Moscow': 'ru',
  'Europe/Oslo': 'no',
  'Europe/Paris': 'fr',
  'Europe/Podgorica': 'me',
  'Europe/Prague': 'cz',
  'Europe/Riga': 'lv',
  'Europe/Rome': 'it',
  'Europe/Samara': 'ru',
  'Europe/San_Marino': 'sm',
  'Europe/Sarajevo': 'ba',
  'Europe/Saratov': 'ru',
  'Europe/Simferopol': 'ua',
  'Europe/Skopje': 'mk',
  'Europe/Sofia': 'bg',
  'Europe/Stockholm': 'se',
  'Europe/Tallinn': 'ee',
  'Europe/Tirane': 'al',
  'Europe/Ulyanovsk': 'ru',
  'Europe/Vaduz': 'li',
  'Europe/Vatican': 'va',
  'Europe/Vienna': 'at',
  'Europe/Vilnius': 'lt',
  'Europe/Volgograd': 'ru',
  'Europe/Warsaw': 'pl',
  'Europe/Zagreb': 'hr',
  'Europe/Zurich': 'ch',
  'Indian/Antananarivo': 'mg',
  'Indian/Chagos': 'io',
  'Indian/Christmas': 'cx',
  'Indian/Cocos': 'cc',
  'Indian/Comoro': 'km',
  'Indian/Kerguelen': 'tf',
  'Indian/Mahe': 'sc',
  'Indian/Maldives': 'mv',
  'Indian/Mauritius': 'mu',
  'Indian/Mayotte': 'yt',
  'Indian/Reunion': 're',
  'Pacific/Apia': 'ws',
  'Pacific/Auckland': 'nz',
  'Pacific/Bougainville': 'pg',
  'Pacific/Chatham': 'nz',
  'Pacific/Chuuk': 'fm',
  'Pacific/Easter': 'cl',
  'Pacific/Efate': 'vu',
  'Pacific/Enderbury': 'ki',
  'Pacific/Fakaofo': 'tk',
  'Pacific/Fiji': 'fj',
  'Pacific/Funafuti': 'tv',
  'Pacific/Galapagos': 'ec',
  'Pacific/Gambier': 'pf',
  'Pacific/Guadalcanal': 'sb',
  'Pacific/Guam': 'gu',
  'Pacific/Honolulu': 'us',
  'Pacific/Kanton': 'ki',
  'Pacific/Kiritimati': 'ki',
  'Pacific/Kosrae': 'fm',
  'Pacific/Kwajalein': 'mh',
  'Pacific/Majuro': 'mh',
  'Pacific/Marquesas': 'pf',
  'Pacific/Midway': 'um',
  'Pacific/Nauru': 'nr',
  'Pacific/Niue': 'nu',
  'Pacific/Norfolk': 'nf',
  'Pacific/Noumea': 'nc',
  'Pacific/Pago_Pago': 'as',
  'Pacific/Palau': 'pw',
  'Pacific/Pitcairn': 'pn',
  'Pacific/Ponape': 'fm',
  'Pacific/Port_Moresby': 'pg',
  'Pacific/Rarotonga': 'ck',
  'Pacific/Saipan': 'mp',
  'Pacific/Tahiti': 'pf',
  'Pacific/Tarawa': 'ki',
  'Pacific/Tongatapu': 'to',
  'Pacific/Truk': 'fm',
  'Pacific/Wake': 'um',
  'Pacific/Wallis': 'wf',
}
const timezoneCountryPrefixOverrides: Array<[string, string]> = [
  ['America/Argentina/', 'ar'],
  ['America/Indiana/', 'us'],
  ['America/Kentucky/', 'us'],
  ['America/North_Dakota/', 'us'],
  ['Antarctica/', 'aq'],
  ['Australia/', 'au'],
]
type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[]
}
type TimezoneOption = SelectOption & {
  value: string
  label: string
  flagCode: string
  flagSrc: string
  offsetLabel: string
}
const flagIconLoaders = import.meta.glob('../../node_modules/flag-icons/flags/4x3/*.svg', {
  import: 'default',
}) as Record<string, () => Promise<string>>
const loadedFlagIconUrls = ref<Record<string, string>>({})
const loadingFlagIconCodes = new Set<string>()

const loading = computed(() => projectLoading.value || accessStatsLoading.value)

const dayOptions = computed(() => [
  { label: t('dashboard.last7Days'), value: 7 },
  { label: t('dashboard.last14Days'), value: 14 },
  { label: t('dashboard.last30Days'), value: 30 },
])

const stats = computed(() => {
  const result: Record<ProjectStatus, number> = {
    active: 0,
    grace: 0,
    expired: 0,
    suspended: 0,
  }

  for (const project of projects.value) {
    result[project.effectiveStatus] += 1
  }

  return result
})

const recentProjects = computed(() => projects.value.slice(0, 5))

const visibleTodayAccessStats = computed(() =>
  loadedAccessStatsTimezone.value === accessStatsTimezone.value ? todayAccessStats.value : null,
)
const visibleDailyAccessStats = computed(() =>
  loadedAccessStatsTimezone.value === accessStatsTimezone.value ? dailyAccessStats.value : null,
)
const dailyAccessItems = computed(() => visibleDailyAccessStats.value?.items ?? [])
const visibleDailyAccessItems = computed(() => dailyAccessItems.value.slice(-dailyDays.value))

const chartTotal = computed(() => visibleDailyAccessItems.value.reduce((total, item) => total + item.total, 0))
const chartAverage = computed(() =>
  visibleDailyAccessItems.value.length ? Math.round(chartTotal.value / visibleDailyAccessItems.value.length) : 0,
)

function getClientTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || defaultTimezone
}

function isValidTimezone(timezone: string | null): timezone is string {
  if (!timezone) return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function readStoredTimezone() {
  if (typeof window === 'undefined') return null

  try {
    const storedTimezone = window.localStorage.getItem(timezoneStorageKey)
    return isValidTimezone(storedTimezone) ? storedTimezone : null
  } catch {
    return null
  }
}

function writeStoredTimezone(timezone: string) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(timezoneStorageKey, timezone)
  } catch {
    // Ignore storage failures so private-mode browsers can still change the active timezone.
  }
}

function getTimezoneFlagCode(timezone: string) {
  const exactCountry = timezoneCountryOverrides[timezone]
  if (exactCountry) return exactCountry

  const prefixCountry = timezoneCountryPrefixOverrides.find(([prefix]) => timezone.startsWith(prefix))?.[1]
  if (prefixCountry) return prefixCountry

  return 'un'
}

function getFlagIconLoader(flagCode: string) {
  return (
    flagIconLoaders[`../../node_modules/flag-icons/flags/4x3/${flagCode}.svg`] ??
    flagIconLoaders['../../node_modules/flag-icons/flags/4x3/un.svg'] ??
    flagIconLoaders['../../node_modules/flag-icons/flags/4x3/xx.svg']
  )
}

function ensureFlagIcon(flagCode: string) {
  if (loadedFlagIconUrls.value[flagCode] || loadingFlagIconCodes.has(flagCode)) return

  const loader = getFlagIconLoader(flagCode)
  if (!loader) return

  loadingFlagIconCodes.add(flagCode)
  void loader()
    .then((url) => {
      loadedFlagIconUrls.value = {
        ...loadedFlagIconUrls.value,
        [flagCode]: url,
      }
    })
    .finally(() => {
      loadingFlagIconCodes.delete(flagCode)
    })
}

function getFlagIconUrl(flagCode: string) {
  return loadedFlagIconUrls.value[flagCode] ?? loadedFlagIconUrls.value.un ?? ''
}

function getTimezoneOffsetLabel(timezone: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const offset = formatter.formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value
    return offset?.replace('GMT', 'UTC') ?? ''
  } catch {
    return ''
  }
}

function createTimezoneOption(timezone: string): TimezoneOption {
  const flagCode = getTimezoneFlagCode(timezone)
  return {
    label: timezone,
    value: timezone,
    flagCode,
    flagSrc: getFlagIconUrl(flagCode),
    offsetLabel: getTimezoneOffsetLabel(timezone),
  }
}

function getSupportedTimezoneValues() {
  const supportedValuesOf = (Intl as IntlWithSupportedValues).supportedValuesOf

  try {
    if (typeof supportedValuesOf === 'function') {
      return supportedValuesOf.call(Intl, 'timeZone')
    }
  } catch {
    // Fall back below for browsers without Intl.supportedValuesOf support.
  }

  return [...fallbackTimezoneValues]
}

function normalizeTimezoneSearch(value: string) {
  return value.trim().replace(/\s+/g, '_').toLowerCase()
}

function getTimezoneSearchRank(timezone: string, search: string) {
  const value = timezone.toLowerCase()
  const readableValue = value.replace(/_/g, ' ')
  const readableSearch = search.replace(/_/g, ' ')

  if (value.startsWith(search) || readableValue.startsWith(readableSearch)) return 0
  if (value.includes(`/${search}`) || readableValue.includes(`/${readableSearch}`)) return 1
  return 2
}

const browserTimezone = getClientTimezone()
const accessStatsTimezone = ref(readStoredTimezone() ?? browserTimezone)
const supportedTimezoneValues = getSupportedTimezoneValues()
const timezoneSearchText = ref('')
const timezoneOptionLimit = ref(timezoneInitialOptionLimit)
let timezoneScrollLoadPending = false
let timezoneScrollUnlockTimer: number | undefined

const timezoneBaseValues = computed(() =>
  Array.from(
    new Set<string>([accessStatsTimezone.value, browserTimezone, 'UTC', defaultTimezone, ...fallbackTimezoneValues, ...supportedTimezoneValues]),
  ).filter(isValidTimezone),
)

const normalizedTimezoneSearchText = computed(() => normalizeTimezoneSearch(timezoneSearchText.value))

const timezoneCandidateValues = computed(() => {
  const values = timezoneBaseValues.value
  const search = normalizedTimezoneSearchText.value
  if (!search) return values

  return values
    .filter((timezone) => {
      const value = timezone.toLowerCase()
      const readableValue = value.replace(/_/g, ' ')
      const readableSearch = search.replace(/_/g, ' ')
      return value.includes(search) || readableValue.includes(readableSearch)
    })
    .sort((left, right) => {
      const rankDiff = getTimezoneSearchRank(left, search) - getTimezoneSearchRank(right, search)
      return rankDiff || left.localeCompare(right)
    })
})

const timezoneAvailableValues = computed(() => {
  if (normalizedTimezoneSearchText.value) return timezoneCandidateValues.value

  return Array.from(
    new Set<string>([accessStatsTimezone.value, browserTimezone, 'UTC', defaultTimezone, ...timezoneCandidateValues.value]),
  ).filter(isValidTimezone)
})

const timezoneOptions = computed<TimezoneOption[]>(() => {
  return timezoneAvailableValues.value.slice(0, timezoneOptionLimit.value).map(createTimezoneOption)
})

function renderTimezoneLabel(option: SelectOption) {
  const timezoneOption = option as TimezoneOption
  const flagNode = timezoneOption.flagSrc
    ? h('img', { class: 'timezone-flag', src: timezoneOption.flagSrc, alt: '' })
    : h('span', { class: 'timezone-flag timezone-flag-placeholder', 'aria-hidden': 'true' })

  return h('span', { class: 'timezone-option' }, [
    flagNode,
    h('span', { class: 'timezone-name' }, timezoneOption.label),
    timezoneOption.offsetLabel ? h('span', { class: 'timezone-offset' }, timezoneOption.offsetLabel) : null,
  ])
}

const timezoneMenuProps = {
  class: 'timezone-select-menu',
}

function loadMoreTimezoneOptions() {
  const nextLimit = Math.min(timezoneOptionLimit.value + timezoneOptionBatchSize, timezoneAvailableValues.value.length)
  if (nextLimit === timezoneOptionLimit.value) return false

  timezoneOptionLimit.value = nextLimit
  return true
}

function restoreTimezoneScroll(target: HTMLElement, scrollTop: number) {
  const maxScrollTop = Math.max(0, target.scrollHeight - target.clientHeight)
  target.scrollTop = Math.min(scrollTop, maxScrollTop)
}

function scrollTimezoneMenuToTop() {
  if (typeof document === 'undefined') return

  const menuScroller = document.querySelector<HTMLElement>('.timezone-select-menu .n-scrollbar-container')
  if (menuScroller) {
    menuScroller.scrollTop = 0
  }
}

function handleTimezoneSearch(value: string) {
  timezoneSearchText.value = value
  timezoneOptionLimit.value = timezoneInitialOptionLimit
  timezoneScrollLoadPending = false
  if (timezoneScrollUnlockTimer) {
    window.clearTimeout(timezoneScrollUnlockTimer)
    timezoneScrollUnlockTimer = undefined
  }

  void nextTick(() => {
    scrollTimezoneMenuToTop()
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollTimezoneMenuToTop)
    }
  })
}

async function handleTimezoneScroll(event: Event) {
  if (timezoneScrollLoadPending) return

  const target = (event.currentTarget ?? event.target) as HTMLElement | null
  if (!target) return

  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight
  if (distanceToBottom <= 48 && timezoneOptionLimit.value < timezoneAvailableValues.value.length) {
    timezoneScrollLoadPending = true
    const scrollTop = target.scrollTop
    const didLoad = loadMoreTimezoneOptions()

    if (didLoad) {
      await nextTick()
      restoreTimezoneScroll(target, scrollTop)
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => restoreTimezoneScroll(target, scrollTop))
      }
    }

    if (timezoneScrollUnlockTimer) {
      window.clearTimeout(timezoneScrollUnlockTimer)
    }
    timezoneScrollUnlockTimer = window.setTimeout(() => {
      timezoneScrollLoadPending = false
      timezoneScrollUnlockTimer = undefined
    }, 120)
  }
}

function handleTimezoneShowUpdate(show: boolean) {
  if (show) return

  timezoneSearchText.value = ''
  timezoneOptionLimit.value = timezoneInitialOptionLimit
  timezoneScrollLoadPending = false
  if (timezoneScrollUnlockTimer) {
    window.clearTimeout(timezoneScrollUnlockTimer)
    timezoneScrollUnlockTimer = undefined
  }
}

async function loadDashboard() {
  const requestId = ++dashboardRequestId
  projectLoading.value = true
  errorText.value = ''

  try {
    const firstPage = await getProjects({ page: 1, pageSize: dashboardPageSize })
    if (requestId !== dashboardRequestId) return

    const loadedProjects = [...firstPage.items]
    const pageCount = Math.ceil(firstPage.total / dashboardPageSize)

    for (let page = 2; page <= pageCount; page += 1) {
      const nextPage = await getProjects({ page, pageSize: dashboardPageSize })
      if (requestId !== dashboardRequestId) return

      loadedProjects.push(...nextPage.items)
    }

    projects.value = loadedProjects
    totalProjects.value = firstPage.total
  } catch (error) {
    if (requestId !== dashboardRequestId) return

    errorText.value = error instanceof Error ? error.message : t('dashboard.loadFailed')
  } finally {
    if (requestId === dashboardRequestId) {
      projectLoading.value = false
    }
  }
}

async function loadAccessStats() {
  const requestId = ++accessStatsRequestId
  accessStatsLoading.value = true
  accessStatsErrorText.value = ''

  try {
    const timezone = accessStatsTimezone.value
    const [today, daily] = await Promise.all([
      getTodayAccessLogStats({ timezone }),
      getDailyAccessLogStats({ timezone, days: 30 }),
    ])
    if (requestId !== accessStatsRequestId) return

    todayAccessStats.value = today
    dailyAccessStats.value = daily
    loadedAccessStatsTimezone.value = timezone
  } catch (error) {
    if (requestId !== accessStatsRequestId) return

    accessStatsErrorText.value = error instanceof Error ? error.message : t('dashboard.accessStatsLoadFailed')
  } finally {
    if (requestId === accessStatsRequestId) {
      accessStatsLoading.value = false
    }
  }
}

function refreshDashboard() {
  void loadDashboard()
  void loadAccessStats()
}

watch(accessStatsTimezone, (timezone, previousTimezone) => {
  if (timezone === previousTimezone) return

  writeStoredTimezone(timezone)
  void loadAccessStats()
})

watch(
  timezoneOptions,
  (options) => {
    for (const flagCode of new Set(options.map((option) => option.flagCode))) {
      ensureFlagIcon(flagCode)
    }
  },
  { immediate: true },
)

onMounted(() => {
  refreshDashboard()
})

onBeforeUnmount(() => {
  dashboardRequestId += 1
  accessStatsRequestId += 1
  if (timezoneScrollUnlockTimer) {
    window.clearTimeout(timezoneScrollUnlockTimer)
  }
})
</script>

<template>
  <div class="page-stack">
    <PageHeader :title="t('nav.dashboard')">
      <template #actions>
        <n-button secondary :loading="loading" @click="refreshDashboard">
          <span class="icon-button-content">
            <RefreshCcw :size="16" />
            {{ t('common.refresh') }}
          </span>
        </n-button>
        <RouterLink to="/projects/create">
          <n-button type="primary">
            <span class="icon-button-content">
              <FolderPlus :size="16" />
              {{ t('common.createProject') }}
            </span>
          </n-button>
        </RouterLink>
      </template>
    </PageHeader>

    <n-alert v-if="errorText" type="error" :bordered="false">{{ errorText }}</n-alert>

    <div class="stats-grid">
      <section class="stat-card apple-card">
        <span>{{ t('dashboard.totalProjects') }}</span>
        <strong>{{ totalProjects }}</strong>
      </section>
      <section v-for="status in statusCards" :key="status" class="stat-card apple-card">
        <StatusBadge :status="status" />
        <strong>{{ stats[status] }}</strong>
      </section>
    </div>

    <section class="section-card access-stats-panel">
      <div class="section-head access-stats-head">
        <div class="access-stats-title-group">
          <h2 class="section-title">{{ t('dashboard.accessStatsTitle') }}</h2>
          <div class="timezone-inline-row">
            <span class="section-description">{{ t('dashboard.statsTimezoneLabel') }}</span>
            <n-select
              v-model:value="accessStatsTimezone"
              class="timezone-select"
              size="small"
              :options="timezoneOptions"
              :render-label="renderTimezoneLabel"
              :consistent-menu-width="false"
              :reset-menu-on-options-change="false"
              :menu-props="timezoneMenuProps"
              remote
              filterable
              @search="handleTimezoneSearch"
              @scroll="handleTimezoneScroll"
              @update:show="handleTimezoneShowUpdate"
            />
          </div>
        </div>
        <div class="access-stats-controls">
          <n-select v-model:value="dailyDays" class="day-select" size="small" :options="dayOptions" />
        </div>
      </div>

      <n-alert v-if="accessStatsErrorText" type="warning" :bordered="false">{{ accessStatsErrorText }}</n-alert>

      <div class="access-stats-grid">
        <article class="access-total-card">
          <div class="access-card-label">
            <CalendarDays :size="18" />
            <span>{{ t('dashboard.todayAccessLogs') }}</span>
          </div>
          <strong>{{ visibleTodayAccessStats?.total ?? 0 }}</strong>
          <div class="access-total-breakdown">
            <span>{{ t('dashboard.allowedRequests', { count: visibleTodayAccessStats?.allowed ?? 0 }) }}</span>
            <span>{{ t('dashboard.deniedRequests', { count: visibleTodayAccessStats?.denied ?? 0 }) }}</span>
          </div>
        </article>

        <article class="access-chart-card">
          <div class="chart-card-head">
            <div class="access-card-label">
              <Activity :size="18" />
              <span>{{ t('dashboard.accessTrend') }}</span>
            </div>
            <div class="chart-summary">
              <span>{{ t('dashboard.periodTotal', { count: chartTotal }) }}</span>
              <span>{{ t('dashboard.periodAverage', { count: chartAverage }) }}</span>
            </div>
          </div>

          <div v-if="accessStatsLoading && !dailyAccessItems.length" class="chart-placeholder" />
          <EmptyState
            v-else-if="!dailyAccessItems.length"
            :title="t('dashboard.noAccessStats')"
            :description="t('logs.accessEmptyDescription')"
          />
          <AccessTrendChart v-else :label="t('dashboard.accessTrend')" :items="dailyAccessItems" :visible-days="dailyDays" />
        </article>
      </div>
    </section>

    <div class="dashboard-grid">
      <section class="section-card">
        <div class="section-head">
          <h2 class="section-title">{{ t('dashboard.recentProjects') }}</h2>
          <RouterLink class="quiet-link" to="/projects">
            {{ t('common.viewAll') }}
            <ChevronRight :size="14" />
          </RouterLink>
        </div>

        <EmptyState
          v-if="!projectLoading && !recentProjects.length"
          :title="t('dashboard.emptyTitle')"
          :description="t('dashboard.emptyDescription')"
        />
        <div v-else class="table-scroll">
          <n-table :bordered="false" :single-line="false">
            <thead>
              <tr>
                <th>{{ t('dashboard.projectName') }}</th>
                <th>slug</th>
                <th>{{ t('common.status') }}</th>
                <th>{{ t('dashboard.updatedAt') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="project in recentProjects" :key="project.id">
                <td>
                  <RouterLink class="project-link" :to="`/projects/${project.id}`">{{ project.name }}</RouterLink>
                </td>
                <td>{{ project.slug }}</td>
                <td><StatusBadge :status="project.effectiveStatus" /></td>
                <td>{{ formatDateTime(project.updatedAt) }}</td>
              </tr>
            </tbody>
          </n-table>
        </div>
      </section>

      <section class="section-card quick-section">
        <h2 class="section-title">{{ t('dashboard.quickActions') }}</h2>
        <RouterLink class="quick-link" to="/projects/create">
          <FolderPlus :size="20" />
          <span>{{ t('common.createProject') }}</span>
          <ChevronRight class="quick-arrow" :size="18" />
        </RouterLink>
        <RouterLink class="quick-link" to="/access-logs">
          <FileClock :size="20" />
          <span>{{ t('dashboard.viewAccessLogs') }}</span>
          <ChevronRight class="quick-arrow" :size="18" />
        </RouterLink>
        <RouterLink class="quick-link" to="/action-logs">
          <ShieldCheck :size="20" />
          <span>{{ t('dashboard.viewActionLogs') }}</span>
          <ChevronRight class="quick-arrow" :size="18" />
        </RouterLink>
      </section>
    </div>

    <p class="dashboard-footer">© 2026 License Console. All rights reserved.</p>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 22px;
}

.stat-card {
  display: flex;
  min-height: 164px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 28px 30px;
}

.stat-card span {
  color: var(--text-secondary);
  font-family: var(--font-apple-text);
  font-size: 15px;
  font-weight: 500;
}

.stat-card strong {
  color: var(--text-main);
  font-family: var(--font-apple-display);
  font-size: 46px;
  font-weight: 700;
  line-height: 1;
}

.access-stats-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.access-stats-head {
  align-items: flex-start;
}

.access-stats-title-group {
  min-width: 0;
}

.section-description {
  color: var(--text-secondary);
  font-size: 13px;
}

.timezone-inline-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.access-stats-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.timezone-select {
  width: 220px;
  flex: 0 0 auto;
}

.day-select {
  width: 146px;
  flex: 0 0 auto;
}

:global(.timezone-option) {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 8px;
}

:global(.timezone-flag) {
  width: 18px;
  height: 13.5px;
  flex: 0 0 auto;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(29, 29, 31, 0.08);
  object-fit: cover;
}

:global(.timezone-flag-placeholder) {
  background: linear-gradient(135deg, #f5f5f7, #e8e8ed);
}

:global(.timezone-name) {
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.timezone-offset) {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  justify-self: end;
  white-space: nowrap;
}

.timezone-select :deep(.timezone-option) {
  grid-template-columns: 20px minmax(0, 1fr);
}

.timezone-select :deep(.timezone-offset) {
  display: none;
}

:global(.timezone-select-menu) {
  width: min(460px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
}

:global(.timezone-select-menu .n-base-select-option__content) {
  width: 100%;
  min-width: 0;
}

:global(.timezone-select-menu .timezone-option) {
  grid-template-columns: 20px minmax(0, 1fr) auto;
}

:global(.timezone-select-menu .timezone-offset) {
  display: inline;
}

.access-stats-grid {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 18px;
}

.access-total-card,
.access-chart-card {
  min-width: 0;
  background: #fbfbfd;
  border: 1px solid var(--border-softer);
  border-radius: 16px;
}

.access-total-card {
  display: flex;
  min-height: 190px;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px 22px;
}

.access-card-label {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 700;
}

.access-card-label svg {
  color: var(--text-main);
}

.access-total-card strong {
  color: var(--text-main);
  font-family: var(--font-apple-display);
  font-size: 44px;
  font-weight: 760;
  line-height: 1;
}

.access-total-breakdown,
.chart-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.access-total-breakdown span,
.chart-summary span {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  padding: 0 11px;
  color: var(--text-secondary);
  background: #ffffff;
  border: 1px solid var(--border-softer);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.access-chart-card {
  display: flex;
  min-height: 190px;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px 12px;
}

.chart-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.chart-summary {
  justify-content: flex-end;
}

.chart-placeholder {
  min-height: 172px;
  background:
    linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent),
    #f2f2f4;
  background-size:
    220px 100%,
    100% 100%;
  border-radius: 14px;
  animation: chart-loading 1.1s ease-in-out infinite;
}

@keyframes chart-loading {
  from {
    background-position:
      -220px 0,
      0 0;
  }

  to {
    background-position:
      calc(100% + 220px) 0,
      0 0;
  }
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 28px;
}

.dashboard-grid .section-card {
  min-height: 414px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.project-link {
  color: var(--text-main);
  font-weight: 600;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
}

.table-scroll :deep(.n-table) {
  min-width: 560px;
}

:deep(.n-table) {
  --n-td-padding: 18px 16px;
  --n-th-padding: 16px;
}

:deep(.n-table th) {
  color: var(--text-secondary);
  background: #fbfbfd;
  font-size: 13px;
  font-weight: 500;
}

:deep(.n-table td) {
  color: var(--text-main);
  font-size: 14px;
}

.quick-section {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 70px;
  padding: 0 18px;
  color: var(--text-main);
  background: #ffffff;
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.quick-link:hover {
  border-color: rgba(29, 29, 31, 0.16);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.055);
  transform: translateY(-1px);
}

.quick-arrow {
  margin-left: auto;
  color: var(--text-tertiary);
}

.dashboard-footer {
  margin: 46px 0 0;
  color: #a1a1a6;
  font-size: 13px;
  text-align: center;
}

@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .access-stats-grid {
    grid-template-columns: 1fr;
  }

  .access-total-card {
    min-height: 150px;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    min-height: 118px;
    padding: 22px;
  }

  .stat-card strong {
    font-size: 38px;
  }

  .dashboard-grid .section-card {
    min-height: 0;
  }

  .access-stats-head,
  .chart-card-head {
    align-items: stretch;
    flex-direction: column;
  }

  .access-stats-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .timezone-inline-row {
    align-items: stretch;
    flex-direction: column;
    gap: 6px;
  }

  .timezone-select,
  .day-select {
    width: 100%;
  }

  .access-total-card,
  .access-chart-card {
    border-radius: 14px;
  }

  .access-total-card {
    padding: 20px;
  }

  .access-total-card strong {
    font-size: 40px;
  }

  .chart-summary {
    justify-content: flex-start;
  }

  .quick-link {
    min-height: 58px;
    padding: 0 14px;
  }

  .dashboard-footer {
    margin-top: 22px;
  }
}
</style>
