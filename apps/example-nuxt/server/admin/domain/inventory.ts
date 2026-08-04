import CategoryResource from '../resources/categories/CategoryResource'
import CommentResource from '../resources/comments/CommentResource'
import MediaResource from '../resources/media/MediaResource'
import MembershipResource from '../resources/memberships/MembershipResource'
import PostTagResource from '../resources/post-tags/PostTagResource'
import PostResource from '../resources/posts/PostResource'
import TagResource from '../resources/tags/TagResource'
import UserResource from '../resources/users/UserResource'
import ContentOverview from '../widgets/ContentOverview'

export const exampleAdminResources = Object.freeze([
  PostResource,
  CategoryResource,
  TagResource,
  CommentResource,
  MediaResource,
  UserResource,
  MembershipResource,
  PostTagResource,
])

export const exampleAdminWidgets = Object.freeze([
  ContentOverview,
])
