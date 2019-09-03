/* eslint no-console:0 */
'use strict'

import ArticleTools from './ArticleTools'
import Helmet from 'react-helmet'
import License from '../components/shared/License'
import Loadable from 'react-loadable'
import LogoIcon from '../../static/asset/icon-placeholder.svg'
import PropTypes from 'prop-types'
import React, { PureComponent } from 'react'
import ReadingProgress from '../components/article/ReadingProgress'
import SystemError from '../components/SystemError'
import commonClassNames from '../components/article/Common.scss'
import cx from 'classnames'
import deviceConst from '../constants/device'
import DonationBox from '../components/shared/DonationBox'
import constStyledComponents from '../constants/styled-components'
import styled from 'styled-components'
import classNames from './Article.scss'
import twreporterRedux from '@twreporter/redux'
import layoutMaker from '../components/article/layout/layout-maker'
import { Body } from '../components/article/Body'
import { BottomRelateds } from '../components/article/BottomRelateds'
import { BottomTags } from '../components/article/BottomTags'
import { Introduction } from '../components/article/Introduction'
import { SITE_META, SITE_NAME } from '../constants/index'
import { articleLayout as layout } from '../themes/layout'
import { camelizeKeys } from 'humps'
import { connect } from 'react-redux'
import { date2yyyymmdd } from '@twreporter/core/lib/utils/date'
import getScreenType from '../utils/screen-type'
import { colors } from '../themes/common-variables'
import mq from '../utils/media-query'

// dependencies of article component v2
import Link from 'react-router-dom/Link'

// lodash
import filter from 'lodash/filter'
import get from 'lodash/get'
import throttle from 'lodash/throttle'
import uniqBy from 'lodash/uniqBy'

// TODO delete codes used styleConst in this file
// after article v2 version launch
const styleConst = {
  photography: 'photography',
  articlePage: {
    fullscreen: {
      dark: 'article:fullscreen:dark',
      normal: 'article:fullscreen:normal'
    },
    v2: {
      default: 'article:v2:default',
      photo: 'article:v2:photo',
      pink: 'article:v2:pink'
    }
  }
}

const _ = {
  filter,
  get,
  throttle,
  uniqBy
}

const { actions, actionTypes, reduxStateFields, utils } = twreporterRedux
const { fetchAFullPost } = actions

const _fontLevel = {
  small: 'small'
}

const ArticleContainer = styled.article`
  color: ${props => props.fontColor ? props.fontColor : colors.gray.gray25};
  a {
      border-bottom: 1px ${colors.primaryColor} solid;
      cursor: pointer;
      transition: 0.5s color ease;
      position: relative;
      color: ${ props => (props.fontColor ? props.fontColor : colors.gray.gray25)};
      &:hover {
        color: ${colors.primaryColor};
      }
  }

  u {
    text-decoration: none;
  }
`

const IntroductionContainer = styled.div`
  display: block;
  margin: 0 auto 80px auto;
  ${mq.desktopAndAbove`
    width: ${layout.desktop.width.small}px;
  `};
  ${mq.tabletOnly`
    width: ${layout.tablet.width.small}px;
  `};
  ${mq.mobileOnly`
    margin: 0 24px 80px 24px;
  `};
`

const scrollPosition = {
  y: 0
}


const ArticlePlaceholder = () => {
  return (
    <constStyledComponents.ResponsiveContainerForAritclePage>
      <div className={classNames['placeholder']}>
        <div className={cx(classNames['title-row'], commonClassNames['inner-block'])}>
          <div className={classNames['ph-title-1']}></div>
          <div className={classNames['ph-title-2']}></div>
          <div className={classNames['ph-author']}></div>
        </div>
        <div className={classNames['leading-img']}>
          <div className={classNames['ph-image']}>
            <LogoIcon className={classNames['logo-icon']} />
          </div>
        </div>
        <IntroductionContainer>
          <div className={classNames['ph-content']}></div>
          <div className={classNames['ph-content']}></div>
          <div className={classNames['ph-content-last']}></div>
        </IntroductionContainer>
      </div>
    </constStyledComponents.ResponsiveContainerForAritclePage>
  )
}

const V2ArticleComponent = Loadable({
  loader: () => import(
    /* webpackChunkName: "v2-article" */
    '@twreporter/react-article-components'
  ),
  loading: ArticlePlaceholder
})

class Article extends PureComponent {
  constructor(props, context) {
    super(props, context)

    // WORKAROUND
    // In fact, `fontLevel` is already in this.props, which is passed by `mapStateToProps` function.
    // However, since in `src/client.js`, we use `ReactDOM.hydrate` to render HTML on production environment.
    // `ReactDOM.hydrate` won't re-render the client side HTML string(checksum might be different from HTML string generated by SSR).
    // Hence, we `setState(fontLevel: updatedFontLevel)` after `componentDidMount` to
    // make HTML re-rendered.
    this.state = {
      fontLevel: 'small'
    }

    this._onScroll = _.throttle(this._handleScroll, 300).bind(this)
    this._handleScroll = this._handleScroll.bind(this)
    this.handleFontLevelChange = this._handleFontLevelChange.bind(this)

    // reading progress component
    this.rp = null

    // article tools
    this._toolsRef = null

    this.articleBody = null
  }

  getChildContext() {
    const { location, entities, selectedPost } = this.props
    const slug = _.get(selectedPost, 'slug', '')
    let post = _.get(entities, [ reduxStateFields.postsInEntities, slug ], {})
    let style = _.get(post, 'style')
    return {
      isPhotography: style === styleConst.photography,
      location
    }
  }

  componentDidMount() {
    // detect sroll position
    window.addEventListener('scroll', this._onScroll)

    // WORKAROUND
    // see the above WORKAROUND comments
    const { fontLevel } = this.props
    this.setState({
      fontLevel
    })
  }

  componentWillMount() {
    const { match } = this.props
    const slug = _.get(match, 'params.slug')
    this.props.fetchAFullPost(slug)
  }

  componentWillUnmount() {
    window.removeEventListener('scroll', this._onScroll)

    scrollPosition.y = 0

    // unset global variables
    this.rp = null
    this._toolsRef = null
    this.articleBody = null
  }

  componentWillReceiveProps(nextProps) {
    const { match } = nextProps
    const slug = _.get(match, 'params.slug')
    const isFetching = _.get(nextProps, 'selectedPost.isFetching') || _.get(this.props, 'selectedPost.isFetching')
    if (slug !== _.get(this.props, 'selectedPost.slug') && !isFetching) {
      this.props.fetchAFullPost(slug)
    }
  }

  /**
   * Calculating the reading progress percentage.
   *
   * @param {number} top - the distance between the top of the element and the viewport top.
   * @param {number} height - the element's height
   */
  _handleReadingPercentage(top, height) {
    if (this.rp) {
      let scrollRatio = 0

      // top is less than 0,
      // which means the element is in the viewport now
      if (top < 0) {
        scrollRatio = Math.abs(top) / height
      }
      const curPercent = Math.round(scrollRatio * 100)
      // update the header progress bar
      this.rp.updatePercentage(curPercent)
    }
  }

  /**
   * According to scroll behavior and viewport width, it will render ArticleTools differnetly.
   * If viewport width is larger than desktop,
   * `ArticleTools` will show up when the top of element(`elementTop`) is approaching the viewport top,
   * and will be still there until the bottom of element(`elementBottom`) is approaching the viewport top.
   *
   * If viewport width is smaller than desktop,
   * `ArticleTools` will show up if users scroll up, and the scrolling distance is more than a certain distance as well.
   * Hides the `ArticleTools` if users scroll down.
   *
   * @param {number} elementTop - the distance between the top of the element and the viewport top.
   * @param {number} elementBottom - the distance between the bottom of the element and the viewport top
   * @param {Object} tools - instance of ArticleTools
   *
   * If elementTop/elementBottom is negative, which means element is already scrolled over the viewport top.
   */
  _handleDesktopToolBars(elementTop, elementBottom, tools) {
    const viewportHeight = window.innerHeight

    // set offset as 10%(refer to `topOffset` in the src/components/article/Body.js) of viewport height,
    // element  will be in the viewport when elementTop approaches the offset
    const offset = Math.round(viewportHeight * 0.1)
    // the top of element is approaching the top of the viewport,
    // render tools
    if (elementTop < offset) {
      tools.toggleTools(true)
    } else {
      // the top of element is far from the viewport top,
      // not render tools
      tools.toggleTools(false)
    }
    // the bottom of element is approaching the top of the viewport,
    // which means the content is almost out of the viewport,
    // no render tools
    if (elementBottom < offset) {
      tools.toggleTools(false)
    }
  }

  _handleNonDesktopToolBars(tools) {
    const currentTopY = window.scrollY

    // Calculate scrolling distance to determine whether tools are displayed
    const lastY = scrollPosition.y
    const distance = currentTopY - lastY
    if (distance > 30) {
      scrollPosition.y = currentTopY
      tools.toggleTools(false)
    } else {
      if (Math.abs(distance) > 150) {
        scrollPosition.y = currentTopY
        tools.toggleTools(true)
      }
    }
  }

  _handleScroll() {
    if (this.articleBody) {
      // top will be the distance between the top of body and the viewport top
      // bottom will be the distance between the bottom of body and the viewport top
      // height is the height of articleBody
      const { top, bottom, height } = this.articleBody.getBoundingClientRect()

      // render reading progress percentage
      this._handleReadingPercentage(top, height)

      // render tool bars
      if (this._toolsRef) {
        const screenType = getScreenType(window.innerWidth)

        // get ArticleTools react component
        const tools = this._toolsRef

        // set screen type
        tools.setScreenType(screenType)

        if (screenType === deviceConst.type.desktop) {
          this._handleDesktopToolBars(top, bottom, tools)
        } else {
          this._handleNonDesktopToolBars(tools)
        }
      }
    }
  }

  _handleFontLevelChange(fontLevel) {
    const { changeFontLevel } = this.props
    this.setState({
      fontLevel
    }, () => {
      changeFontLevel(fontLevel)
    })
  }

  render() {
    const { entities, match, selectedPost, isLeadingAssetFullScreen, styles } = this.props
    const { fontLevel } = this.state
    const error = _.get(selectedPost, 'error')
    if (error) {
      return (
        <div>
          <SystemError error={error} />
        </div>
      )
    }

    if (_.get(selectedPost, 'slug') !== _.get(match, 'params.slug')) {
      return null
    }

    const postEntities = _.get(entities, reduxStateFields.postsInEntities)
    const topicEntities = _.get(entities, reduxStateFields.topicsInEntities)
    const slug = _.get(selectedPost, 'slug', '')
    const isFetching = _.get(selectedPost, 'isFetching')

    // prepare related posts and that topic which post belongs to
    // for v2 article
    const v2Article = _.get(postEntities, slug, {})
    let v2RelatedPosts = utils.denormalizePosts(_.get(v2Article, 'relateds', []), postEntities)
    const v2Topics = utils.denormalizeTopics(_.get(v2Article, 'topics', []), topicEntities, postEntities)
    const v2Topic = _.get(v2Topics, '0', {})

    v2RelatedPosts = [].concat(v2RelatedPosts, _.get(v2Topic, 'relateds', []))
    // dedup related posts
    v2RelatedPosts = _.uniqBy(v2RelatedPosts, 'id')
    v2RelatedPosts = _.filter(v2RelatedPosts, (related) => { return related.id!== v2Article.id})

    // for v1 article
    const article = camelizeKeys(v2Article)
    const relateds = camelizeKeys(v2RelatedPosts)
    const topic = camelizeKeys(v2Topic)
    const bodyData = _.get(article, [ 'content', 'apiData' ], [])
    const introData = _.get(article, [ 'brief', 'apiData' ], [])
    const topicName = _.get(topic, 'topicName')
    const topicArr = _.get(topic, 'relateds')
    const articleStyle = _.get(article, 'style')

    // for head tag
    const canonical = SITE_META.URL + 'a/' + slug
    const ogTitle = (_.get(article, 'ogTitle', '') || _.get(article, 'title', '')) + SITE_NAME.SEPARATOR + SITE_NAME.FULL
    const ogDesc = _.get(article, 'ogDescription', SITE_META.DESC)
    const ogImage = _.get(article, 'ogImage.resizedTargets.mobile.url', SITE_META.OG_IMAGE)

    const license = _.get(article, 'copyright', 'Creative-Commons')

    let articleComponentJSX = null

    if (isFetching) {
      articleComponentJSX = <ArticlePlaceholder />
    } else if (articleStyle === styleConst.articlePage.v2.pink ||
      articleStyle === styleConst.articlePage.v2.default ||
      articleStyle === styleConst.articlePage.v2.photo
    ) {
      articleComponentJSX = (
        <div
          id="article-body"
          ref={node => this.articleBody = node}
        >
          <V2ArticleComponent
            post={v2Article}
            relatedTopic={v2Topic}
            relatedPosts={v2RelatedPosts}
            fontLevel={fontLevel}
            onFontLevelChange={this.handleFontLevelChange}
            LinkComponent={Link}
          />
        </div>
      )
    } else {
      // render leading components, including
      // title, subtitle, topic name, hero image, leading video, authors and share buttons.
      // Those components will be rendered in different orders on demand
      const layoutJSX = layoutMaker.renderLayout({
        article,
        topic,
        isLeadingAssetFullScreen,
        styles,
        fontSize: fontLevel,
        changeFontSize: this.handleFontLevelChange
      })

      articleComponentJSX = (
        <React.Fragment>
          <ArticleContainer
            fontColor={styles.text.fontColor}
            ref={div => {this.progressBegin = div}}
          >
            {layoutJSX}
            <div
              id="article-body"
              ref={node => this.articleBody = node}
            >
              <IntroductionContainer>
                <Introduction
                  data={introData}
                  fontSize={fontLevel}
                />
              </IntroductionContainer>
              <Body
                data={bodyData}
                fontSize={fontLevel}
                articleStyle={articleStyle}
              />
            </div>
          </ArticleContainer>
          <DonationBox />
          <License license={license} publishedDate={article.publishedDate}/>
          <constStyledComponents.ResponsiveContainerForAritclePage
            size="small"
          >
            <BottomTags
              data={article.tags}
            />
            <BottomRelateds
              relateds={relateds}
              currentId={article.id}
              topicName={topicName}
              topicArr={topicArr}
            />
          </constStyledComponents.ResponsiveContainerForAritclePage>
          {/* TODO move ArticleTools into react-article-components */}
          <ArticleTools
            ref={ ele => this._toolsRef = ele }
          />
        </React.Fragment>
      )
    }

    return (
      <div>
        <Helmet
          title={ogTitle}
          link={[
            { rel: 'canonical', href: canonical }
          ]}
          meta={[
            { name: 'description', content: ogDesc },
            { name: 'twitter:title', content: ogTitle },
            { name: 'twitter:image', content: ogImage },
            { name: 'twitter:description', content: ogDesc },
            { name: 'twitter:card', content: 'summary_large_image' },
            { property: 'og:title', content: ogTitle },
            { property: 'og:description', content: ogDesc },
            { property: 'og:image', content: ogImage },
            { property: 'og:type', content: 'article' },
            { property: 'og:url', content: canonical },
            { property: 'og:rich_attachment', content: 'true' }
          ]}
        />
        <div itemScope itemType="http://schema.org/Article">
          <div itemProp="publisher" itemScope itemType="http://schema.org/Organization">
            <meta itemProp="name" content="報導者" />
            <meta itemProp="email" content="contact@twreporter.org" />
            <link itemProp="logo" href="https://www.twreporter.org/asset/logo-large.png" />
            <link itemProp="url" href="https://www.twreporter.org/" />
          </div>
          <link itemProp="mainEntityOfPage" href={canonical} />
          <meta itemProp="dateModified" content={date2yyyymmdd(_.get(article, 'updatedAt'))} />
          <ReadingProgress ref={ele => this.rp = ele}/>
          { articleComponentJSX }

        </div>
      </div>
    )
  }
}

Article.childContextTypes = {
  location: PropTypes.object,
  isPhotography: PropTypes.bool
}

Article.propTypes = {
  entities: PropTypes.object,
  match: PropTypes.object,
  selectedPost: PropTypes.object,
  styles: PropTypes.shape({
    text: PropTypes.shape({
      fontColor: PropTypes.string
    }),
    title: PropTypes.shape({
      fontColor: PropTypes.string
    }),
    subtitle: PropTypes.shape({
      fontColor: PropTypes.string
    }),
    topic: PropTypes.shape({
      fontColor: PropTypes.string
    })
  }).isRequired,
  isLeadingAssetFullScreen: PropTypes.bool.isRequired
}

Article.defaultProps = {
  entities: {},
  // react-router `match` object
  match: {},
  selectedPost: {}
}

function chooseStyles(articleStyle) {
  let styles = {
    text: {
      fontColor: colors.gray.gray25
    },
    title: {
      fontColor: colors.gray.gray25
    },
    subtitle: {
      fontColor: 'gray'
    },
    topic: {
      fontColor: colors.primaryColor
    }
  }

  switch(articleStyle) {
    case styleConst.articlePage.fullscreen.normal: {
      styles.title.fontColor = colors.white
      styles.subtitle.fontColor = colors.white
      styles.topic.fontColor = colors.white
      break
    }
    case styleConst.articlePage.fullscreen.dark: {
      styles.text.fontColor = 'rgba(255, 255, 255, 0.8)'
      styles.title.fontColor = colors.white
      styles.subtitle.fontColor = colors.white
      styles.topic.fontColor = colors.white
      break
    }
    case styleConst.photography: {
      styles.text.fontColor = 'rgba(255, 255, 255, 0.8)'
      styles.title.fontColor = colors.white
      break
    }
    default: {
      break
    }
  }
  return styles
}

function isLeadingAssetFullScreen(articleStyle) {
  let isLeadingAssetFullScreen = false

  switch(articleStyle) {
    case styleConst.articlePage.fullscreen.dark:
    case styleConst.articlePage.fullscreen.normal: {
      isLeadingAssetFullScreen = true
      break
    }
    default: {
      break
    }
  }
  return isLeadingAssetFullScreen
}

export function mapStateToProps(state) {
  const fontLevel = _.get(state, [ reduxStateFields.settings, 'fontLevel' ], _fontLevel.small)
  const entities = state[reduxStateFields.entities]
  const selectedPost = state[reduxStateFields.selectedPost]
  const post = _.get(entities, [ reduxStateFields.postsInEntities, selectedPost.slug ], {})
  const style = post.style

  return {
    fontLevel,
    entities,
    selectedPost,
    styles: chooseStyles(style),
    isLeadingAssetFullScreen: isLeadingAssetFullScreen(style)
  }
}

function changeFontLevel(fontLevel) {
  return function (dispatch) {
    dispatch({
      type: actionTypes.settings.changeFontLevel,
      payload: fontLevel
    })
  }
}

export { Article }
export default connect(mapStateToProps, { fetchAFullPost, changeFontLevel })(Article)
