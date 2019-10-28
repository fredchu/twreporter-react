import { connect } from 'react-redux'
import { List } from '@twreporter/react-components/lib/listing-page'
import { SITE_META, SITE_NAME } from '../constants/index'
import categoryConst from '../constants/category'
import Helmet from 'react-helmet'
import Pagination from '../components/Pagination'
import PropTypes from 'prop-types'
import qs from 'qs'
import React, { PureComponent } from 'react'
import SystemError from '../components/SystemError'
import twreporterRedux from '@twreporter/redux'
// lodash
import get from 'lodash/get'
import isInteger from 'lodash/isInteger'

const _  = {
  get,
  isInteger
}

const { actions, reduxStateFields, utils } = twreporterRedux
const { fetchListedPosts } = actions

const MAXRESULT = 10
const categories = 'categories'

class Category extends PureComponent {
  componentDidMount() {
    this._fetchListedPosts()
  }

  componentDidUpdate() {
    this._fetchListedPosts()
  }
  
  _fetchListedPosts() {
    const { fetchListedPosts, catId } = this.props
    const page = _.get(this.props, 'page', 1)
    fetchListedPosts(catId, categories, MAXRESULT, page)
  }

  render() {
    let isFetching = false

    const {
      catId,
      catLabel,
      entities,
      lists,
      page,
      pathname
    } = this.props
    const postEntities = _.get(entities, reduxStateFields.postsInEntities, {})

    // total items will be in that catId
    const total = _.get(lists, [ catId, 'total' ], 0)
    const totalPages = Math.ceil(total / MAXRESULT)
    if (
      !_.isInteger(page) ||
      totalPages && (page > totalPages) ||
      page < 1
    ) {
      return (
        <SystemError error={{ status: 404 }} />
      )
    }

    // pages will be like
    // {
    //   1: [0, 9],
    //   3: [10, 19],
    // }
    //
    // which means the items of page 1 are in items[0] to items[9],
    // the items of page 3 are in items[10] to item [19]
    const pages = _.get(lists, [ catId, 'pages' ], {})
    const startPos = _.get(pages, [ page, 0 ], 0)
    const endPos = _.get(pages, [ page, 1 ], 0)

    // page is provided, but not fecth yet
    if (startPos === 0 && endPos === 0) {
      isFetching = true
    }

    // denormalize the items of current page
    const posts = utils.denormalizePosts(_.get(lists, [ catId, 'items' ], []).slice(startPos, endPos + 1), postEntities)
    const postsLen = _.get(posts, 'length', 0)
    // Error handling
    const error = _.get(lists, [ catId, 'error' ], null)
    if (error !== null && postsLen === 0) {
      return (
        <SystemError error={error} />
      )
    } else if (postsLen === 0) {
      isFetching = true
    }

    const title = catLabel + SITE_NAME.SEPARATOR + SITE_NAME.FULL
    const canonical = `${SITE_META.URL_NO_SLASH}${pathname}`

    return (
      <div>
        <Helmet
          title={title}
          link={[
            { rel: 'canonical', href: canonical }
          ]}
          meta={[
            { name: 'description', content: SITE_META.DESC },
            { name: 'twitter:title', content: title },
            { name: 'twitter:description', content: SITE_META.DESC },
            { name: 'twitter:image', content: SITE_META.OG_IMAGE },
            { property: 'og:title', content: title },
            { property: 'og:description', content: SITE_META.DESC },
            { property: 'og:image', content: SITE_META.OG_IMAGE },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: canonical }
          ]}
        />
        <List
          data={posts}
          catName={catLabel}
          isFetching={isFetching}
        />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
        />
      </div>
    )
  }
}

function mapStateToProps(state, props) {
  const search = _.get(props, 'location.search')
  const query = qs.parse(search, { ignoreQueryPrefix: true })
  const page = parseInt(_.get(query, 'page', 1), 10)
  const pathSegment = _.get(props, 'match.params.category')
  const catId = categoryConst.ids[pathSegment]
  const catLabel = categoryConst.labels[pathSegment]
  const pathname = _.get(props, 'location.pathname', `/categories/${pathSegment}`)
  return {
    lists: state[reduxStateFields.lists],
    entities: state[reduxStateFields.entities],
    catId,
    catLabel,
    page,
    pathname
  }
}

Category.defaultProps = {
  entities: {},
  lists: {},
  catId: ''
}

Category.propTypes = {
  entities: PropTypes.object,
  lists: PropTypes.object,
  catId: PropTypes.string,
  catLabel: PropTypes.string.isRequired,
  page: PropTypes.number.isRequired,
  pathname: PropTypes.string.isRequired
}

export { Category }
export default connect(mapStateToProps, { fetchListedPosts })(Category)
