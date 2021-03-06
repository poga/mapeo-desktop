// @flow
import React from 'react'
import { RawIntlProvider, IntlProvider, FormattedTime } from 'react-intl'
import {
  Page,
  Text,
  View,
  Image,
  Document,
  StyleSheet
} from '@react-pdf/renderer'
import FormattedLocation from '../internal/FormattedLocation'
import { isEmptyValue } from '../utils/helpers'
import { get } from '../utils/get_set'
import FormattedFieldname from '../internal/FormattedFieldname'
import FormattedValue from '../internal/FormattedValue'
import type { PaperSize, CommonViewContentProps } from '../types'
import {
  SettingsContext,
  defaultSettings,
  type SettingsContextType
} from '../internal/Context'
import type { Observation } from 'mapeo-schema'
import api from '../../../new-api'

type Props = {
  ...$Exact<$Diff<CommonViewContentProps, { onClick: * }>>,
  /** Rendering a PDF does not inherit context from the parent tree. Get this
   * value with useIntl() and provide it as a prop */
  intl?: any,
  /** Rendering a PDF does not inherit context from the parent tree. Get this
   * value with React.useContext(SettingsContext) and provide it as a prop */
  settings?: SettingsContextType,
  /** Paper size for report */
  paperSize?: PaperSize
}

type PageProps = {
  renderImages: boolean,
  getPreset: $ElementType<Props, 'getPreset'>,
  getMedia: $ElementType<Props, 'getMedia'>,
  observation: Observation
}

/*  TODO: add frontpage
const FrontPage = ({ bounds }) => {
  var opts = {
    bounds,
    width: 400,
    height: 400,
    dpi: 4
  }

  return (
    <Image cache={true} src={api.getMapImageURL(opts)} />
  )
}

  var sw = [180, 90]
  var ne = [-180, -90]
  observations.forEach((obs) => {
    sw[0] = Math.min(obs.lon, sw[0])
    sw[1] = Math.min(obs.lat, sw[1])
    ne[0] = Math.max(obs.lon, ne[0])
    ne[1] = Math.max(obs.lat, ne[1])
  })
  var bounds = [sw[0], sw[1], ne[0], ne[1]]
  <Page key="front" size="A4" style={styles.page}>
    <FrontPage bounds={bounds} />
  </Page>
*/

const PDFReport = ({
  observations,
  intl,
  settings = defaultSettings,
  ...otherProps
}: Props) => {

  const children = (
    <SettingsContext.Provider value={settings}>
      <Document>
        {observations.map((obs) => (
          <Page key={obs.id} size="A4" style={styles.page} wrap>
            <FeaturePage
              key={obs.id}
              observation={obs}
              {...otherProps}
            />
          </Page>
        ))}
      </Document>
    </SettingsContext.Provider>
  )
  // Need to provide `intl` for dates to format according to language, but will
  // fallback to `en` with default intl object
  return intl ? (
    <RawIntlProvider value={intl}>{children}</RawIntlProvider>
  ) : (
    <IntlProvider>{children}</IntlProvider>
  )
}

const FeaturePage = ({ observation, getPreset, getMedia }: PageProps) => {
  var view = new ObservationView(observation, getPreset, getMedia)
  return (
    <View style={styles.pageContent}>
      <View style={styles.columnLeft}>
      <Text style={styles.presetName}>{view.preset.name || 'Observation'}</Text>
      {view.createdAt ? (
        <Text style={styles.createdAt}>
          <Text style={styles.createdAtLabel}>Registrado: </Text>
          <FormattedTime
            key="time"
            value={view.createdAt}
            year="numeric"
            month="long"
            day="2-digit"
          />
        </Text>
      ): null}
      {view.coords ? (
        <Text style={styles.location}>
          <Text style={styles.locationLabel}>Ubicación: </Text>
          <FormattedLocation {...view.coords} />
        </Text>
      ): null}
      <View>
        {view.note ?
          view.note.split('\n').map((para, idx) => (
            <Text key={idx} style={styles.description}>
              {para}
            </Text>
          )): null}
      </View>
      <Text style={styles.details}>Detalles</Text>
      {view.fields.map(field => {
        const value = get(view.tags, field.key)
        if (isEmptyValue(value)) return null
        return (
          <View key={field.id} style={styles.field} wrap={false}>
            <Text style={styles.fieldLabel}>
              <FormattedFieldname field={field} component={Text} />
            </Text>
            <Text style={styles.fieldValue}>
              <FormattedValue field={field} value={value} />
            </Text>
          </View>
        )
      })}
    </View>
    <ObservationRHS observationView={view} />
  </View>
  )
}

function ObservationRHS ({observationView}) {
  var src = observationView.getMapImageURL()

  return (
    <View style={styles.columnRight}>
      <Image
        src={src}
        key={'minimap-' + observationView.id}
        style={styles.image}
        wrap={false}
        cache={true}
      />

      {observationView.mediaItems.map((src, i) => (
        <Image cache={true} src={src} key={i} style={styles.image} wrap={false} />
      ))}
    </View>
  )
}


class ObservationView {
  static DEFAULT_ZOOM_LEVEL = 11

  constructor (observation, getPreset, getMedia) {
    this.id = observation.id
    this.coords =
      typeof observation.lon === 'number' && typeof observation.lat === 'number'
        ? {
            longitude: observation.lon,
            latitude: observation.lat
          }
        : undefined
    this.createdAt =
      typeof observation.created_at === 'string'
        ? new Date(observation.created_at)
        : undefined

    this.preset = getPreset(observation)
    this.fields = this.preset.fields.concat(this.preset.additionalFields)
    this.tags = observation.tags || {}
    this.note = this.tags.note || this.tags.notes
    this.mediaItems = (observation.attachments || []).reduce(
      (acc, cur) => {
        const item = getMedia(cur, { width: 800, height: 600 })
        if (item && item.type === 'image') acc.push(item.src)
        return acc
      },
      []
    )
  }

  getMapImageURL (zoom) {
    if (!zoom) zoom = ObservationView.DEFAULT_ZOOM_LEVEL

    var opts = {
      width: 250,
      height: 250,
      lon: this.coords.longitude,
      lat: this.coords.latitude,
      zoom: 11,
      dpi: 2
    }
    return api.getMapImageURL(opts)
  }

}

export default PDFReport

// Convert pixel to millimetres
function mm(v) {
  return v / (25.4 / 72)
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: 'white',
    paddingVertical: mm(20),
    paddingHorizontal: mm(15),
    flexDirection: 'row'
  },
  pageContent: {
    flex: 1,
    flexDirection: 'row'
  },
  columnLeft: {
    flex: 2,
    paddingRight: 12,
    lineHeight: 1.2
  },
  columnRight: {
    // backgroundColor: 'aqua',
    flex: 1
  },
  presetName: {
    fontWeight: 700
  },
  createdAt: {
    fontSize: 12
  },
  createdAtLabel: {
    fontSize: 12,
    color: 'grey'
  },
  location: {
    fontSize: 12,
    marginBottom: 6
  },
  locationLabel: {
    fontSize: 12,
    color: 'grey'
  },
  map: {
    height: '60mm',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'black',
    marginBottom: 12,
    backgroundColor: '#8E918B'
  },
  image: {
    height: '40mm',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'black',
    marginBottom: 10,
    backgroundColor: '#C8D8E3'
  },
  description: {
    marginBottom: 6,
    fontSize: 12
  },
  details: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 3,
    marginTop: 12
  },
  field: {
    marginBottom: 6
  },
  fieldLabel: {
    fontSize: 9,
    marginBottom: 1,
    color: '#333333'
  },
  fieldValue: {
    fontSize: 12
  },
  header: {},
  footer: {}
})
