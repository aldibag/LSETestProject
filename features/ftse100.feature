Feature: Get FTSE 100 Top Movers

  @top10
  Scenario: Extract top 10 constituents by % change
    Given I navigate to the FTSE 100 constituents page
    When I extract the list of constituents and their percentage changes
    Then I display the top 10 constituents with the highest percentage change

  @bottom10
  Scenario: Extract bottom 10 constituents by % change
    Given I navigate to the FTSE 100 constituents page
    And I navigate to the last page of the table
    When I extract the list of constituents and their percentage changes
    Then I display the top 10 constituents with the lowest percentage change

  @marketcapBelow7
  Scenario: Extract companies with Market Cap > 7 million
    Given I navigate to the FTSE 100 constituents page
    And I accept the cookies policy
    When I extract all constituents whose Market Cap exceeds 7 million
    Then I display the list of these constituents

    @lowestIn3years
    Scenario:  Find the month with the lowest average index value over the past 3 years
      Given I navigate to the FTSE 100 indices page
      And I accept the cookies policy
      And I set the date range to the last 3Y and sort it by Month
      When I extract the average index value for each month
      Then I see the lowest index value printed with its date printed.


