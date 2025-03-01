/**
 * External dependencies
 */
import { By } from 'selenium-webdriver';

/**
 * Internal dependencies
 */
import AsyncBaseContainer from '../async-base-container';

import SidebarComponent from '../components/sidebar-component.js';
import NavBarComponent from '../components/nav-bar-component.js';

import * as DriverHelper from '../driver-helper.js';

export default class InvitePeoplePage extends AsyncBaseContainer {
	constructor( driver ) {
		super( driver, By.css( 'fieldset#role' ) );
	}

	async inviteNewUser( email, role, message = '' ) {
		if ( role === 'viewer' ) {
			role = 'follower'; //the select input option uses follower for viewer
		}

		const roleLocator = By.css( `fieldset#role input[value=${ role }]` );

		await DriverHelper.setWhenSettable( this.driver, By.css( 'input.token-field__input' ), email );
		await DriverHelper.clickWhenClickable( this.driver, roleLocator );
		await DriverHelper.setCheckbox( this.driver, roleLocator );
		await DriverHelper.setWhenSettable( this.driver, By.css( '#message' ), message );
		return await DriverHelper.clickWhenClickable(
			this.driver,
			By.css( '.invite-people button.button.is-primary:not([disabled])' )
		);
	}

	async backToPeopleMenu() {
		const navbarComponent = await NavBarComponent.Expect( this.driver );
		await navbarComponent.clickMySites();

		const sideBarComponent = await SidebarComponent.Expect( this.driver );
		return await sideBarComponent.selectPeople();
	}
}
