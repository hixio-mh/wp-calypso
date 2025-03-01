/**
 * External dependencies
 */
import assert from 'assert';
import config from 'config';

/**
 * Internal dependencies
 */
import LoginFlow from '../lib/flows/login-flow.js';

import AcceptInvitePage from '../lib/pages/accept-invite-page.js';
import PostsPage from '../lib/pages/posts-page.js';
import PeoplePage from '../lib/pages/people-page.js';
import RevokePage from '../lib/pages/revoke-page.js';
import InviteErrorPage from '../lib/pages/invite-error-page.js';
import InvitePeoplePage from '../lib/pages/invite-people-page.js';
import EditTeamMemberPage from '../lib/pages/edit-team-member-page.js';
import LoginPage from '../lib/pages/login-page.js';
import ReaderPage from '../lib/pages/reader-page.js';
import ViewBlogPage from '../lib/pages/signup/view-blog-page.js';
import PrivateSiteLoginPage from '../lib/pages/private-site-login-page.js';

import NoticesComponent from '../lib/components/notices-component.js';
import NavBarComponent from '../lib/components/nav-bar-component.js';
import NoSitesComponent from '../lib/components/no-sites-component.js';

import * as dataHelper from '../lib/data-helper.js';
import * as driverManager from '../lib/driver-manager.js';
import EmailClient from '../lib/email-client.js';

const mochaTimeOut = config.get( 'mochaTimeoutMS' );
const startBrowserTimeoutMS = config.get( 'startBrowserTimeoutMS' );
const inviteInboxId = config.get( 'inviteInboxId' );
const password = config.get( 'passwordForNewTestSignUps' );
const screenSize = driverManager.currentScreenSize();
const host = dataHelper.getJetpackHost();
const emailClient = new EmailClient( inviteInboxId );

describe( `[${ host }] Invites:  (${ screenSize })`, function () {
	this.timeout( mochaTimeOut );
	let driver;

	before( 'Start browser', async function () {
		this.timeout( startBrowserTimeoutMS );
		driver = await driverManager.startBrowser();
	} );

	describe( 'Inviting new user as an Editor: @parallel @jetpack', function () {
		const newUserName = 'e2eflowtestingeditora' + new Date().getTime().toString();
		const newInviteEmailAddress = dataHelper.getEmailAddress( newUserName, inviteInboxId );
		let acceptInviteURL = '';
		let inviteCreated = false;
		let inviteAccepted = false;

		it( 'Can log in and navigate to Invite People page', async function () {
			await new LoginFlow( driver ).loginAndSelectPeople();
			const peoplePage = await PeoplePage.Expect( driver );
			return await peoplePage.inviteUser();
		} );

		it( 'Can invite a new user as an editor and see its pending', async function () {
			const invitePeoplePage = await InvitePeoplePage.Expect( driver );
			await invitePeoplePage.inviteNewUser(
				newInviteEmailAddress,
				'editor',
				'Automated e2e testing'
			);
			const noticesComponent = await NoticesComponent.Expect( driver );
			await noticesComponent.isSuccessNoticeDisplayed();
			inviteCreated = true;
			await invitePeoplePage.backToPeopleMenu();

			const peoplePage = await PeoplePage.Expect( driver );
			await peoplePage.selectInvites();
			return await peoplePage.waitForPendingInviteDisplayedFor( newInviteEmailAddress );
		} );

		it( 'Can see an invitation email received for the invite', async function () {
			const emails = await emailClient.pollEmailsByRecipient( newInviteEmailAddress );
			const links = emails[ 0 ].html.links;
			const link = links.find( ( l ) => l.href.includes( 'accept-invite' ) );
			acceptInviteURL = dataHelper.adjustInviteLinkToCorrectEnvironment( link.href );
			return assert.notEqual(
				acceptInviteURL,
				'',
				'Could not locate the accept invite URL in the invite email'
			);
		} );

		it( 'Can sign up as new user for the blog via invite link', async function () {
			await driverManager.ensureNotLoggedIn( driver );

			await driver.get( acceptInviteURL );
			const acceptInvitePage = await AcceptInvitePage.Expect( driver );

			const actualEmailAddress = await acceptInvitePage.getEmailPreFilled();
			const headerInviteText = await acceptInvitePage.getHeaderInviteText();
			assert.strictEqual( actualEmailAddress, newInviteEmailAddress );
			assert( headerInviteText.includes( 'editor' ) );

			await acceptInvitePage.enterUsernameAndPasswordAndSignUp( newUserName, password );
			return await acceptInvitePage.waitUntilNotVisible();
		} );

		it( 'User has been added as Editor', async function () {
			await PostsPage.Expect( driver );

			inviteAccepted = true;
			const noticesComponent = await NoticesComponent.Expect( driver );
			const invitesMessageTitleDisplayed = await noticesComponent.getNoticeContent();
			return assert(
				invitesMessageTitleDisplayed.includes( 'Editor' ),
				`The invite message '${ invitesMessageTitleDisplayed }' does not include 'Editor'`
			);
		} );

		it( 'As the original user can see and remove new user', async function () {
			await new LoginFlow( driver ).loginAndSelectPeople();

			const peoplePage = await PeoplePage.Expect( driver );
			await peoplePage.selectTeam();
			await peoplePage.searchForUser( newUserName );
			const numberPeopleShown = await peoplePage.numberSearchResults();
			assert.strictEqual(
				numberPeopleShown,
				1,
				`The number of people search results for '${ newUserName }' was incorrect`
			);

			await peoplePage.selectOnlyPersonDisplayed();
			const editTeamMemberPage = await EditTeamMemberPage.Expect( driver );
			await editTeamMemberPage.removeUserAndDeleteContent();
			const noticesComponent = await NoticesComponent.Expect( driver );
			const displayed = await noticesComponent.isSuccessNoticeDisplayed();
			return assert.strictEqual(
				displayed,
				true,
				'The deletion successful notice was not shown on the people page.'
			);
		} );

		it( 'As the invited user, I am no longer an editor on the site', async function () {
			if ( 'WPCOM' !== dataHelper.getJetpackHost() ) return this.skip();
			const loginPage = await LoginPage.Visit( driver );
			await loginPage.login( newUserName, password );
			await ReaderPage.Expect( driver );

			const navBarComponent = await NavBarComponent.Expect( driver );
			await navBarComponent.clickMySites();
			return await NoSitesComponent.Expect( driver );
		} );

		after( async function () {
			if ( inviteCreated ) {
				try {
					await new LoginFlow( driver ).loginAndSelectPeople();
					const peoplePage = await PeoplePage.Expect( driver );
					await peoplePage.selectInvites();

					// Sometimes, the 'accept invite' step fails. In these cases, we perform cleanup
					//    by revoking, instead of clearing accepted invite.
					if ( inviteAccepted ) {
						await peoplePage.goToClearAcceptedInvitePage( newUserName );
					} else {
						await peoplePage.goToRevokeInvitePage( newInviteEmailAddress );
					}

					const clearOrRevokeInvitePage = await RevokePage.Expect( driver );
					await clearOrRevokeInvitePage.revokeUser();
				} catch {
					console.log( 'Invites cleanup failed for (Inviting new user as an Editor)' );
					return;
				}
			}
		} );
	} );

	describe( 'Inviting new user as an Editor and revoke invite: @parallel @jetpack', function () {
		const newUserName = 'e2eflowtestingeditorb' + new Date().getTime().toString();
		const newInviteEmailAddress = dataHelper.getEmailAddress( newUserName, inviteInboxId );
		let acceptInviteURL = '';

		it( 'Can log in and navigate to Invite People page', async function () {
			await new LoginFlow( driver ).loginAndSelectPeople();
			const peoplePage = await PeoplePage.Expect( driver );
			return await peoplePage.inviteUser();
		} );

		it( 'Can Invite a New User as an Editor, then revoke the invite', async function () {
			const invitePeoplePage = await InvitePeoplePage.Expect( driver );
			await invitePeoplePage.inviteNewUser(
				newInviteEmailAddress,
				'editor',
				'Automated e2e testing'
			);
			const noticesComponent = await NoticesComponent.Expect( driver );
			await noticesComponent.isSuccessNoticeDisplayed();
			await invitePeoplePage.backToPeopleMenu();

			const peoplePage = await PeoplePage.Expect( driver );
			await peoplePage.selectInvites();
			await peoplePage.waitForPendingInviteDisplayedFor( newInviteEmailAddress );

			await peoplePage.goToRevokeInvitePage( newInviteEmailAddress );

			const revokePage = await RevokePage.Expect( driver );
			await revokePage.revokeUser();
			const sent = await noticesComponent.isSuccessNoticeDisplayed();
			return assert( sent, 'The sent confirmation message was not displayed' );
		} );

		it( 'Can see an invitation email received for the invite', async function () {
			const emails = await emailClient.pollEmailsByRecipient( newInviteEmailAddress );
			const links = emails[ 0 ].html.links;
			const link = links.find( ( l ) => l.href.includes( 'accept-invite' ) );
			acceptInviteURL = dataHelper.adjustInviteLinkToCorrectEnvironment( link.href );
			return assert.notEqual(
				acceptInviteURL,
				'',
				'Could not locate the accept invite URL in the invite email'
			);
		} );

		it( 'Can open the invite page and see it has been revoked', async function () {
			await driverManager.ensureNotLoggedIn( driver );

			await driver.get( acceptInviteURL );
			await AcceptInvitePage.Expect( driver );

			const inviteErrorPage = await InviteErrorPage.Expect( driver );
			const displayed = await inviteErrorPage.inviteErrorTitleDisplayed();
			return assert( displayed, 'The invite was not successfully revoked' );
		} );
	} );

	describe( 'Inviting New User as a Viewer of a WordPress.com Private Site: @parallel', function () {
		const newUserName = 'e2eflowtestingviewer' + new Date().getTime().toString();
		const newInviteEmailAddress = dataHelper.getEmailAddress( newUserName, inviteInboxId );
		const siteName = config.get( 'privateSiteForInvites' );
		const siteUrl = `https://${ siteName }/`;
		let removedViewerFlag = true;
		let acceptInviteURL = '';
		let inviteCreated = false;
		let inviteAccepted = false;

		it( 'As an anonymous user I can not see a private site', async function () {
			return await PrivateSiteLoginPage.Visit( driver, siteUrl );
		} );

		it( 'Can log in and navigate to Invite People page', async function () {
			await new LoginFlow( driver, 'privateSiteUser' ).loginAndSelectPeople();
			const peoplePage = await PeoplePage.Expect( driver );
			return await peoplePage.inviteUser();
		} );

		it( 'Can invite a new user as a viewer and see its pending', async function () {
			const invitePeoplePage = await InvitePeoplePage.Expect( driver );
			await invitePeoplePage.inviteNewUser(
				newInviteEmailAddress,
				'viewer',
				'Automated e2e testing'
			);
			const noticesComponent = await NoticesComponent.Expect( driver );
			await noticesComponent.isSuccessNoticeDisplayed();
			inviteCreated = true;
			await invitePeoplePage.backToPeopleMenu();

			const peoplePage = await PeoplePage.Expect( driver );
			await peoplePage.selectInvites();
			return await peoplePage.waitForPendingInviteDisplayedFor( newInviteEmailAddress );
		} );

		it( 'Can see an invitation email received for the invite', async function () {
			const emails = await emailClient.pollEmailsByRecipient( newInviteEmailAddress );
			const links = emails[ 0 ].html.links;
			const link = links.find( ( l ) => l.href.includes( 'accept-invite' ) );
			acceptInviteURL = dataHelper.adjustInviteLinkToCorrectEnvironment( link.href );
			return assert.notEqual(
				acceptInviteURL,
				'',
				'Could not locate the accept invite URL in the invite email'
			);
		} );

		it( 'Can sign up as new user for the blog via invite link', async function () {
			await driverManager.ensureNotLoggedIn( driver );

			await driver.get( acceptInviteURL );
			const acceptInvitePage = await AcceptInvitePage.Expect( driver );

			const actualEmailAddress = await acceptInvitePage.getEmailPreFilled();
			const headerInviteText = await acceptInvitePage.getHeaderInviteText();
			assert.strictEqual( actualEmailAddress, newInviteEmailAddress );
			assert( headerInviteText.includes( 'view' ) );

			await acceptInvitePage.enterUsernameAndPasswordAndSignUp( newUserName, password );
			removedViewerFlag = false;
			return await acceptInvitePage.waitUntilNotVisible();
		} );

		it( 'Can see user has been added as a Viewer', async function () {
			inviteAccepted = true;
			const noticesComponent = await NoticesComponent.Expect( driver );
			const followMessageDisplayed = await noticesComponent.getNoticeContent();
			assert.strictEqual(
				true,
				followMessageDisplayed.includes( 'viewer' ),
				`The follow message '${ followMessageDisplayed }' does not include 'viewer'`
			);

			await ReaderPage.Expect( driver );
			return await ViewBlogPage.Visit( driver, siteUrl );
		} );

		it( 'Can see new user added and can be removed', async function () {
			await new LoginFlow( driver, 'privateSiteUser' ).loginAndSelectPeople();

			const peoplePage = await PeoplePage.Expect( driver );
			await peoplePage.selectViewers();
			let displayed = await peoplePage.viewerDisplayed( newUserName );
			assert( displayed, `The username of '${ newUserName }' was not displayed as a site viewer` );

			await peoplePage.removeUserByName( newUserName );
			await peoplePage.waitForSearchResults();
			displayed = await peoplePage.viewerDisplayed( newUserName );
			if ( displayed === false ) {
				removedViewerFlag = true;
			}
			return assert.strictEqual(
				displayed,
				false,
				`The username of '${ newUserName }' was still displayed as a site viewer`
			);
		} );

		it( 'Can not see the site - see the private site log in page', async function () {
			const loginPage = await LoginPage.Visit( driver );
			await loginPage.login( newUserName, password );

			await ReaderPage.Expect( driver );
			return await PrivateSiteLoginPage.Visit( driver, siteUrl );
		} );

		after( async function () {
			if ( inviteCreated ) {
				try {
					await new LoginFlow( driver, 'privateSiteUser' ).loginAndSelectPeople();
					const peoplePageCleanup = await PeoplePage.Expect( driver );
					await peoplePageCleanup.selectInvites();

					// Sometimes, the 'accept invite' step fails. In these cases, we perform cleanup
					//    by revoking, instead of clearing accepted invite.
					if ( inviteAccepted ) {
						await peoplePageCleanup.goToClearAcceptedInvitePage( newUserName );
					} else {
						await peoplePageCleanup.goToRevokeInvitePage( newInviteEmailAddress );
					}

					const clearOrRevokeInvitePage = await RevokePage.Expect( driver );
					await clearOrRevokeInvitePage.revokeUser();
				} catch {
					console.log(
						'Invites cleanup failed for (Inviting New User as a Viewer of a WordPress.com Private Site)'
					);
					return;
				}
			}

			if ( ! removedViewerFlag ) {
				await new LoginFlow( driver, 'privateSiteUser' ).loginAndSelectPeople();
				const peoplePage = await PeoplePage.Expect( driver );

				await peoplePage.selectViewers();
				const displayed = await peoplePage.viewerDisplayed( newUserName );
				if ( displayed ) {
					await peoplePage.removeUserByName( newUserName );

					return await peoplePage.waitForSearchResults();
				}
			}
		} );
	} );
} );
