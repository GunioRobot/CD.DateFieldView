/*globals CD */

sc_require('views/calendar');

/** @class

  The CD.DateFieldView is a textfield that displays a
  formatted date string, accepts many date string formats
  to set a date and provides a popup selectable calendar.

  This is a BETA.

  Features it currently *partially* implements:

    - some locale independant date formatting/
      validation
    - date selection by popup selectable calendar
    - integer-date manipulation
      - e.g. type `+1' and tab and it will set the
        date to today's date +1 day
      - e.g. type `-1' and tab and it will set the
        date to today's date -1 day
    - supports multiple instantiations of itself on
      any form/view/pane
    - reformats valid user typed input to a formal
      date string format

  Features that have yet to be added:

    - true locale independence
      - includes formatting of date strings via
        preference and/or default regional setting (?)
    - easier theming
    - intelligent placement of popup calendar
    - default date support

  @extends SC.View
*/
CD.DateFieldView = SC.View.extend(
  SC.StatechartManager, SC.Control, {

  // ..........................................................
  // PROPERTIES
  //

  /** @private
    The calendar view to be placed in the popup.

    @type Object
  */
  calendar: null,

  /** @private
    The textfield to display the date string or accept
    the user typed date string.

    @field
    @type Object
  */
  textfield: null,

  /**
    Whether or not the textfield is focused and editing.

    @type Bool
    @default NO
  */
  isEditing: NO,

  /**
    The current state of validity of the view relative
    to the status of the selectedDate.

    @type Bool
    @default YES
  */
  isValid: YES,

  /**
    The layout to be set for the textfield.

    @type Object
  */
  textFieldLayout: { centerX: 0, centerY: 0, width: 150, height: 22 },

  /**
    The layout of the calendar popup.

    @TODO: Currently ignored, needs to be used.
  */
  calendarLayout: { width: 220, height: 220 },

  /**
    The currently selected date. Should be attached to
    a controller that is set with a default date unless
    the default behavior of today's date is desired.

    @type SC.DateTime
    @default SC.DateTime.create()
  */
  selectedDate: SC.DateTime.create(),

  /** @private
    @TODO: Remove dependence on this feature.

    @type SC.DateTime
    @default SC.DateTime.create() (today's date)
  */
  lastValidDate: SC.DateTime.create(),

  /** @private
    @TODO: Remove dependence on this feature.

    @type String
    @default null
  */
  lastValue: null,

  // ..........................................................
  // METHODS
  //

  /** @private
    Overloaded function to create the childviews
    according to the needs of the view.

    @returns {void}
  */
  createChildViews: function() {

    var views = [], view, that = this;

    view = this.textfield = this.createChildView(
      SC.TextFieldView.extend({
        layout: that.get('textFieldLayout') ||
          { centerX: 0, centerY: 0, height: 24, width: 150 },
        hint: 'date ex: ' + SC.DateTime.create().toFormattedString("%m/%d/%y"),
        rightAccessoryView: SC.ImageView.extend({
          layout: { top: 3, right: 3, width: 20, height: 20 },
          value: 'calendar-2-16-icon',
          mouseDown: function(e) {
            that.sendEvent('calendarIconClicked');
            return NO;
          },
          mouseUp: function(e) {
            return YES;
          },
        }),
      })
    );

    this.calendar = SC.PickerPane.create({
      layout: that.get('calendarLayout') || { width: 300, height: 300 },
      contentView: CD.CalendarView.extend({
        layout: that.get('calendarLayout') || this.get('parentView.layout'),
        targetView: that,
        selectedDateBinding: '.targetView.selectedDate',
      }),
      show: function() {
        this.popup(that.get('textfield'), SC.PICKER_FIXED);
      },
      removeTarget: that,
      removeAction: 'calendarLostFocus',
    });

    views.push(view);

    this.bind('isSelected', '.textfield.isEditing');
    this.bind('value', '.textfield.value');

    this.set('childViews', views);
    arguments.callee.base.apply(this,arguments);

  },

  /** @private
    Replaces the Calendar layer to update it based
    on validity changes.

    @TODO: this is only necessary because of the
      order of events and non-concurrent substates

  */
  isValidDidChange: function() {
    if(this.get('isValid') === YES)
      this.getPath('calendar.contentView').replaceLayer();
  }.observes('isValid'),

  /** @private
    Determines whether or not the passed value is an operation
    string (does NOT determine validity).

    @param {String} the value to be tested
    @return {Bool} if it is/is-not an op string
  */
  isOpString: function(value) {

    // if the string is empty or only 1 character long
    // it is NOT an op string
    if(!value || value.length <= 1)
      return NO;

    // BASIC sanity check just to make sure the length is correct
    // and it begins with a `+' or `-'
    // @TODO: is there an SC builtin helper to convert arrays to
    // generic objects for this test?
    // e.g. convert ['+','-'] to {'+':'', '-':''}
    if(value.length >= 2 && value.charAt(0) in {'+':'', '-':''})
      return YES;

    // default
    return NO;
  },

  /** @private
    Validates an operator or possible operator.

    @param {String} representing operation
    @returns {Bool} if it was a valid operation or not
  */
  validateOp: function(value) {

    // if(!value || value.length <= 1)
    //   return NO;

    // // determine if the value begins with a +/- binary operator
    // // and is at least 2 characters and anything after the operator
    // // is an integer
    // // @TODO: is there an SC builtin helper to convert arrays to
    // // generic objects for this test?
    // // e.g. convert ['+','-'] to {'+':'', '-':''}
    // if(value.length >= 2 && value.charAt(0) in {'+':'', '-':''}) {
    if(this.isOpString(value) === YES) {
      // @NOTE: if it is a zero, to spare unnecessary
      // invalid state it will be converted to 'today'
      // regardless of the sign so we return YES
      if(parseInt(value.charAt(1)) == 0 && value.length == 2)
        return YES;

      // if it is longer than 2 and begins with a `0' it is
      // assumed to be invalid
      // @TODO: maybe it should just strip it if it can?
      if(parseInt(value.charAt(1)) == 0 && value.length > 2)
        return NO;

      // make sure the value after the operator is actually
      // a determinable number
      if(isNaN(parseInt(value.substr(1, value.length))))
        return NO;

      // if it contains any letters we invalidate it even
      // though it was somehow parsed to an int
      if(value.match(/[a-zA-Z]+/g))
        return NO;

      return YES;
    }

    return NO;
  },

  /** @private
    Parses a valid operation (e.g. `+1', etc.) and executes
    the operation on today's date.

    @param {String} valid operation from user input
    @returns {SC.DateTime} the correct date post operation
  */
  parseOp: function(value) {

    // sadly, to make sure this doesn't get called manually
    // go ahead and test the validity of the op to make sure
    // we don't crash anything
    if(this.validateOp(value) === NO)

      // @TODO: needs to be replaced?
      // to be safe and without crashing the thing just return
      // today's date
      // return SC.DateTime.create().toISO8601();
      return NO;

    // retrieve the current selectedDate, the integer value
    // from the Op and the operator
    var date = SC.DateTime.create(), op = value.charAt(0),
      num = value.substr(1, value.length);

    date = date.advance({ day: parseInt((op == "+" ? "" : "-") + num) });

    // return the value of the advanced date in milliseconds
    // return date.toISO8601();
    return date;
  },

  /** @private
    Validates the current value in the textfield.

    @returns {Bool} whether or not the value was valid
  */
  validate: function() {

    var value = this.get('value');

    // @TODO: should be changed to offer use of
    // default date?
    // if the current value is empty it is
    // assumed to be valid
    if(!value)
      return YES;

    // determine if it is a valid operator
    if(this.validateOp(value) === YES)
      return YES;

    // if it is an op string...but invalid (as just determined)
    // we can return false
    if(this.isOpString(value) === YES)
      return NO;

    // if not empty determine if the value is a
    // valid date known to the javascript Date object
    var valid = Date.parse(this.get('value'));

    // if the returned value is not a number
    // then it is invalid
    if(isNaN(valid))
      return NO;

    // if it is a number, we assume it is a valid
    // determinable date
    else { return YES; }
  }.property('value'),

  /** @private
    Returns a string with a locale version of the
    date. Takes a passed date or uses the currently
    selected date (default). Can handle a native
    Javascript Date object or a SC.DateTime object.

    @TODO: This currently only works for the U.S.
      locale due to the length of the default date
      string formats. Need an appropriate way to
      handle this?

    @param (optional) {SC.DateTime} OR {Date}
    @returns {String}
  */
  localeDateString: function(dateObj) {
    var str, date;

    if(!dateObj && !this.get('selectedDate'))
      return '';

    if(SC.instanceOf(dateObj, SC.DateTime)) {
      date = new Date(dateObj.get('milliseconds'));
    }

    else if(SC.instanceOf(dateObj, Date))
      date = dateObj;

    if(!date) {

      date = this.get('selectedDate');

      if(!date)
        return '';

      date = new Date(date.get('milliseconds'));

    }

    return date.toLocaleDateString();
  },

  // -- Observers/Monitored Properties
  // @TODO: Would love to find a way to avoid these.
  isSelectedDidChange: function() {
    if(this.get('isSelected') === YES)
      this.sendEvent('isEditing');
    else if(this.get('isEditing') === NO)
      this.sendEvent('isNotEditing');
    return YES;
  }.observes('isSelected'),
  valueDidChange: function() {
    this.sendEvent('valueDidChange');
  }.observes('value'),
  selectedDateDidChange: function() {
    this.sendEvent('selectedDateDidChange');
  }.observes('selectedDate'),

  // ..........................................................
  // STATECHART
  //

  // -- Coniguruation
  trace: NO,
  initialState: 'UNFOCUSED',

  // -- Special
  didCreateLayer: function() {
    this.set('owner', this);
  },

  // -- States
  "UNFOCUSED": SC.State.design({

    enterState: function() {

      if(!this.getPath('owner.layer'))
        return;

      // if the state was left as INVALID then redraw
      // the calendar and return
      if(this.get('owner.isValid') === NO) {
        this.getPath('owner.calendar.contentView').replaceLayer();
        return;
      }

      var date, value = this.getPath('owner.value');

      // if we lose focus but were left with a valid
      // Op statement or date input go ahead and set the textfield to the
      // appropriate value otherwise do nothing

      if(!value)
        return;

      if(this.getPath('owner.validate') === YES) {

        // if the value is a valid operation parse it
        // and retrieve the new Date object
        if(this.get('owner').validateOp(value) === YES)
          date = this.get('owner').parseOp(value);

        // otherwise attempt to create a new SC.DateTime object
        // via the Date object's parse ability (needs a string)
        else { date = SC.DateTime.create(Date.parse(value)); }

        // if(!date) { return; }
        if(SC.instanceOf(date, SC.DateTime) === NO &&
          SC.instanceOf(date, Date) === NO)
          return;
      }

      // do nothing?
      else { return; }

      // update the textfield to show the localized version
      // of the validated Op statement
      // the valueDidChange function will fire an event that will
      // attempt to update the selectedDate for us

      // retrieve the new value
      var str = this.get('owner').localeDateString(date);

      // don't actually update it if they are the same
      if(this.getPath('owner.value') != str)
        this.setPath('owner.value', this.get('owner').localeDateString(date));

    },

    // -- Actions
    valueDidChange: function() {

      // @TODO: this shouldn't happen but if it MUST
      //    there should have been a way to test whether
      //    or not the calendar was showing
      //    should bind to the PickerPanes property `isVisibleInWindow'

      // possibly need to redraw the calendar

      // if it is NOT valid, do nothing
      if(this.getPath('owner.validate') === NO)
        return;

      // @TODO: this is getting ridiculous...redraw the calendar...
      this.getPath('owner.calendar.contentView').replaceLayer();

    },
    isEditing: function() {
      this.gotoState('FOCUSED');
    },
    calendarIconClicked: function() {
      this.getPath('owner.calendar').show();
    },
    nextClicked: function() {
      var date = this.getPath('owner.selectedDate') ||
        this.getPath('owner.calendar.selectedDate') ||
        SC.DateTime.create();
      this.setPath('owner.selectedDate',
        date.advance({ month: 1 })
      );
    },
    prevClicked: function() {
      var date = this.getPath('owner.selectedDate') ||
        this.getPath('owner.calendar.selectedDate') ||
        SC.DateTime.create();
      this.setPath('owner.selectedDate',
        date.advance({ month: -1 })
      );
    },
    selectedDateDidChange: function() {

      // since the textfield isn't focused go ahead and
      // update its value to the newly updated selectedDate value
      // which was set by the calendar or some other view/controller
      // this.setPath('owner.value', this.getPath('owner.localeDateString'));

      // retrieve the new string
      var str = this.get('owner').localeDateString();

      // only update if they are different so as not to throw the extra
      // event
      if(this.getPath('owner.value') != str)
        this.setPath('owner.value', this.get('owner').localeDateString());

      // @TODO: hack. ugly.........should not be here!
      //    THIS SHOULD BE COVERED AND SHOWS A NEED FOR
      //    CONCURRENT SUBSTATES (e.g. `valid', `invalid')...
      // validate the value and update isValid if it is
      this.setPath('owner.isValid', this.getPath('owner.validate'));

    },
    calendarLostFocus: function() {

      // remove the picker pane
      this.getPath('owner.calendar').remove();

      // @TODO: this needs major revision to incorporate preferences...etc
      // set the value of the textfield to the selected date from
      // the calendar
      // this.setPath('owner.value', this.getPath('owner.localeDateString'));
      // this.setPath('owner.value', this.get('owner').localeDateString());

      // set the textfield to focus for convenience
      // as testing proved the behavior or allowing the
      // calendar to lose focus without auto-selecting the
      // textfield to be very awkward
      this.getPath('owner.textfield').$().focus();
    },

  }),
  "FOCUSED": SC.State.design({

    // -- Configuration
    initialSubstate: 'VALIDATING',

    // -- States
    "VALIDATING": SC.State.design({

      enterState: function() {
        if(this.getPath('owner.validate') === YES)
          this.gotoState('VALID');
        else
          this.gotoState('INVALID');
      },
    }),
    "VALID": SC.State.design({

      enterState: function() {
        this.setPath('owner.isValid', YES);

        // redraw the calendar...because of a single scenario
        // where a blank value is valid here but needs to reset
        // the date in the calendar...
        this.getPath('owner.calendar.contentView').replaceLayer();

        // @TODO: this needs to be updated as there should
        //  be a far more intelligent communication internally
        //  about when to update

        // this seems to be a problem as it shouldn't update
        // without a change being noted...

        this.get('statechart').sendEvent('updateSelectedDate');
      },

      // -- Actions
      updateSelectedDate: function() {
        var date, value = this.getPath('owner.value'),
          current = this.getPath('owner.selectedDate');

        // in the case that the field is marked valid but empty
        // we need to not update the selectedDate value
        if(!value)
          return;

        // if the value is one of the valid binary operators +/-
        // followed by valid integer(s) we reset the `value' variable
        // and continue normally
        if(this.get('owner').validateOp(value))
          value = this.get('owner').parseOp(value);

        // recreate the value as a SC.DateTime object
        // by the following convoluted mess...

        // @TODO: this is a problem...
        // date = SC.DateTime.create(Date.parse(value));

        // since parseOp returns a Date object now...
        if(SC.instanceOf(value, Date))
          date = SC.DateTime.create(value.UTC());

        // if we have a SC.DateTime object...
        else if(SC.instanceOf(value, SC.DateTime))
          date = value;

        // we need to attempt to parse the value of the text
        // and it *should* work since its been validated...
        else { date = SC.DateTime.create(Date.parse(value)); }

        // determine if the current `selectedDate' is...anything
        // if not, set `lastValidDate' and `selectedDate' to
        // `date'
        if(!current) {
          this.setPath('owner.lastValidDate', date);
          this.setPath('owner.selectedDate', date);
        }

        // if the new date is NOT equal to the current selectedDate
        // set the selectedDate property to this new date
        // also update the last valid date to be the current date
        else if(date.isEqual(current) === NO) {
          this.setPath('owner.lastValidDate', current);
          this.setPath('owner.selectedDate', date);
        }
      },
    }),
    "INVALID": SC.State.design({

      // update isValid to `NO' and set the selectedDate
      // value to the last known valid date unless it
      // is already equal to it
      enterState: function() {
        var current = this.getPath('owner.selectedDate'),
          last = this.getPath('owner.lastValidDate');

        this.setPath('owner.isValid', NO);

        // redraw the calendar so it will update to correct day (today)
        this.getPath('owner.calendar.contentView').replaceLayer();

        // if there is not `current' value test for last
        // if there is no `last' return its ok to be null
        if(!current) {
          if(!last)
            return;

          // this is being rethought...
          // maybe it should not do anything
          else {
            // this.setPath('owner.selectedDate',
            //   this.getPath('owner.lastValidDate'));
            return;
          }
        }

        // same as above...
        // else if(current.isEqual(last) === NO)
        //   this.setPath('owner.selectedDate',
        //     this.getPath('owner.lastValidDate'));
      },
    }),

    // -- Actions
    isNotEditing: function() {
      this.gotoState('UNFOCUSED');
    },
    calendarIconClicked: function() {
      this.getPath('owner.calendar').show();
      this.gotoState('UNFOCUSED');
    },
    valueDidChange: function() {

      // test to see if the previous value is the
      // the same...
      // @TODO: this also needs to be updated to a
      //    new method based on better inter-communication
      var last = this.getPath('owner.lastValue'),
        current = this.getPath('owner.value');

      // if last is unknown set it to the current value
      // and continue to VALIDATING state
      if(!last) { this.setPath('owner.lastValue', current); }

      // if last and current are the same then do nothing
      else if(last == current) { return; }

      // this implicitly handles the scenario where
      // last was not undefined or '' and did not
      // equal the current value

      // continue to VALIDATING state
      this.gotoState('VALIDATING');
    },

  }),

});
